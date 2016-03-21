var path = require('path');

var async = require('async');
var chokidar = require('chokidar');
var config = require('config');
var cookieParser = require('cookie-parser');
var cors = require('cors');
var express = require('express');
var lessMiddleware = require('less-middleware');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var promise = require('bluebird');

var task = require('geronimo.task');

var browserify = require('./browserify');
var lessc = require('./lessc');
var proxy = require('./proxy');
var routers = require('./routers');
var webSocket = require('./webSocket');

module.exports = function() {
    var app = express();
    var cfg = config.get('server');
    var httpServer;
    var webSocketServer;

    /**
     * 初始化
     */
    var init = function() {
        var pro = promise.resolve();
        if (cfg.useCookieParser) pro.then(useCookieParser); // 解析Cookie
        if (cfg.cors) pro.then(useCors); // 允许跨域
        pro.then(useSession); // 使用session
        pro.then(browserify.init); // 加载配置文件中的browserify相关配置，生成静态公共文件
        pro.then(useBrowserify); // 使用browserify来进行包管理
        pro.then(lessc.init); // 生成静态公共样式文件
        pro.then(useLessc); // 使用预处理器来处理css相关文件
        if (!cfg.proxy.useProxy) pro.then(useRouters); // 加载routers文件
        if (cfg.proxy.useProxy) pro.then(useRouters().then(useProxy)); // 使用代理
        pro.then(task.start); // 任务部署
        pro.then(useStaticSource); // 处理静态资源
        pro.done();
    };

    /**
     * 处理静态资源
     */
    var useStaticSource = function() {
        return new promise(function(resolve) {
            async.waterfall([function(next) { // 解析Static配置下的静态资源路径
                async.forEachSeries(cfg.Static.path, function(p, next) {
                    app.use(express.static(p, cfg.Static.config));
                    next();
                }, next);
            }, function(next) { // 解析web页面的公共模块相关静态资源路径设置
                async.forEachSeries(cfg.browserify.commonReferenceModule, function(m, next) {
                    if (m.path) {
                        m.path.forEach(function(p) {
                            app.use(express.static(p, cfg.Static.config));
                        });
                    }
                    next();
                }, next);
            }], resolve);
        });
    };

    /**
     * 解析Cookie
     */
    var useCookieParser = function() {
        return new promise(function(resolve) {
            app.use(cookieParser());
            resolve();
        });
    };

    /**
     * 允许跨域
     */
    var useCors = function() {
        return new promise(function(resolve) {
            app.use(cors());
            resolve();
        });
    };

    /**
     * 使用session
     */
    var useSession = function() {
        return new promise(function(resolve) {
            var sessionCfg = cfg.session.config;
            if (process.env.NODE_ENV === 'production') {
                sessionCfg.store = new RedisStore(cfg.redis.config);
            }
            app.use(session(sessionCfg));
            resolve();
        });
    };

    /**
     * 使用代理
     */
    var useProxy = function() {
        return new promise(function(resolve) {
            app.use(cfg.proxy.pattern, proxy);
            resolve();
        });
    };

    /**
     * 使用browserify来进行包管理
     */
    var useBrowserify = function() {
        return new promise(function(resolve) {
            app.get(cfg.browserify.commonReferenceUrl, browserify.getCommonFile);
            app.get('*.js', browserify.browseFile);
            resolve();
        });
    };

    /**
     * 使用预处理器来处理css相关文件
     */
    var useLessc = function() {
        return new promise(function(resolve) {
            app.get(cfg.less.commonReferenceUrl, lessc.getCommonFile);
            if (process.env.NODE_ENV !== 'production') {
                cfg.less.path.forEach(function(p) {
                    app.use(lessMiddleware(p, cfg.less.config));
                });
            }
            resolve();
        });
    };

    /**
     * 加载routers文件
     */
    var useRouters = function() {
        return routers.fileRouters(app, express);
    };

    /**
     * 添加监听事件
     */
    var addListeners = function() {
        cfg.less.path.forEach(function(p) {
            chokidar.watch(path.join(p, '/**/*.less')).on('change', function(pth) {
                webSocketServer.getClients().forEach(function(client) {
                    client.emit('data', pth.replace(p, '').replace('.less', '.css'));
                });
            });
        });
    };

    /**
     * 监听，即启动web服务
     */
    this.listen = function() {
        return new promise(function(resolve) {
            httpServer = app.listen(cfg.port, resolve);
            if (process.env.NODE_ENV !== 'production' || cfg.useSocket) {
                webSocketServer = new webSocket(httpServer);
                addListeners();
            }
        });
    };

    /**
     * 获取web服务对象
     */
    this.getApp = function() {
        return app;
    };

    /**
     * 获取代理对象
     */
    this.getProxy = function() {
        return proxy;
    };

    /**
     * 获取配置信息
     */
    this.getConfig = function() {
        return cfg;
    };

    /**
     * 获取http服务对象
     */
    this.getHttpServer = function() {
        return httpServer;
    };

    /**
     * 获取webSocket服务对象
     */
    this.getWebSocketServer = function() {
        return webSocketServer;
    };

    /**
     * 获取所有中间件
     */
    this.getMiddle = function() {
        return {
            bodyParser: routers.bodyParserMiddle
        };
    };

    init();
};
