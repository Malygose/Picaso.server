var fs = require('fs');
var path = require('path');

var async = require('async');
var browserify = require('browserify');
var config = require('config');
var md5 = require('blueimp-md5');
var npm = require('npm');
var promise = require('bluebird');

var utils = require('picaso.utils');

var commonFile = require('./commonFile');
/**
 * 加载配置文件中的browserify相关配置，生成静态公共文件
 */
module.exports.init = function() {
    return new promise(function(resolve) {
        // 生成静态文件存放文件夹
        var generateStaticFolder = function() {
            return new promise(function(res) {
                var backupPath = path.join(__dirname, './backup');
                if (process.env.NODE_ENV == 'production') {
                    if (fs.existsSync(backupPath)) {
                        async.waterfall([function(next) {
                            fs.readdir(backupPath, next);
                        }, function(paths, next) {
                            async.forEachSeries(paths, function(p, next) {
                                fs.unlink(path.join(backupPath, p), next);
                            }, next);
                        }], res);
                    } else {
                        fs.mkdir(backupPath, res);
                    }
                } else {
                    res();
                }
            });
        };

        // 生成公共文件
        var generateCommonFile = function() {
            if (process.env.NODE_ENV == 'production') {
                return commonFile.generateInProduction();
            } else {
                return commonFile.generateInDevelop();
            }
        };

        generateStaticFolder().then(generateCommonFile).then(resolve).done();
    });
};

/**
 * 当请求公共文件时，将公共文件以流的形式传送出去
 */
module.exports.getCommonFile = function(req, res) {
    fs.createReadStream(path.join(__dirname, './_.js')).pipe(res);
};

/**
 * 当请求模块文件时，将模块文件以流的形式传送出去
 */
module.exports.getSubFile = function(req, res) {
    fs.createReadStream(path.join(__dirname, './backup', req.url)).pipe(res);
};

/**
 * 处理js文件做出的请求
 */
module.exports.browseFile = function(req, res) {
    if (process.env.NODE_ENV == 'production') {
        var backupPath = path.join(__dirname, './backup', md5.md5(req.url) + '.js');
        if (fs.existsSync(backupPath)) {
            fs.createReadStream(backupPath).pipe(res);
        } else {
            var sourcePath = path.join(config.get('server.Static.path')[0], req.url);

            if (fs.existsSync(sourcePath)) {
                browserify(sourcePath).bundle(function(err, r) {
                    if (err) {
                        res.send(utils.disposeBrowserifyError(err));
                    } else {
                        fs.createWriteStream(backupPath).write(r);
                        res.send(r);
                    }
                });
            } else {
                res.send('console.error(\'' + req.url + ' is not exist\');');
            }
        }
    } else {
        var filePath = path.join(config.get('server.Static.path')[0], req.url);
        if (fs.existsSync(filePath)) {
            browserify(filePath).bundle(function(err, r) {
                if (err && config.get('autoInstallReferenceModule')) {
                    installReferenceModule(err, req, res, module.exports.browseFile);
                } else if (err) {
                    res.send(utils.disposeBrowserifyError(err));
                } else {
                    res.send(r);
                }
            });
        } else {
            res.send('console.error(\'' + req.url + ' is not exist\');');
        }
    }
};

/**
 * 安装服务器端没有却被web页面引用的模块
 */
function installReferenceModule(err, req, res, next) {
    async.waterfall([function(next) {
        npm.load(config.get('npm.config'), next);
    }, function(data, next) {
        var module = err.message.split('\' from \'')[0];
        npm.config.set('registry', config.get('npm.registry.local'));
        console.info('Prepare for ' + module.substring(module.indexOf('\'') + 1) + '..');
        npm.install(module.substring(module.indexOf('\'') + 1), next);
    }], function(err) {
        if (err) {
            console.danger('WARN'.inverse + ' ' + err.message.magenta);
            res.send('console.error(\'' + err.message + ' is not exist\');');
        } else {
            next(req, res);
        }
    });
}
