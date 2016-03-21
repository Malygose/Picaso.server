var fs = require('fs');
var path = require('path');

var bodyParser = require('body-parser');
var config = require('config');
var findit = require('findit');
var promise = require('bluebird');

var cls = require('geronimo.utils').console;

/**
 * 将路由文件加载到web服务中
 */
module.exports.fileRouters = function(app, express) {
    var cfg = config.get('server.routers');
    var bodyParserMiddle = [bodyParser.urlencoded({
        extended: false
    }), bodyParser.json()];

    return new promise(function(resolve) {
        fs.exists(cfg.path, function(exist) {
            if (exist) {
                var finder = findit(cfg.path);
                finder.on('directory', function(dir, stat, stop) {
                    if (cfg.checkSubFolders === false && dir !== cfg.path) {
                        stop();
                    }
                });

                finder.on('file', function(file, stat) {
                    if (!~file.indexOf('.DS_Store') && cfg.usePathAsRoute && config.get('server.useBodyParser')) {
                        app.use(file.replace(cfg.path, '').replace(path.basename(file), ''), bodyParserMiddle, require(file)(express.Router()));
                    } else if (!~file.indexOf('.DS_Store') && cfg.usePathAsRoute) {
                        app.use(file.replace(cfg.path, '').replace(path.basename(file), ''), require(file)(express.Router()));
                    } else if (!~file.indexOf('.DS_Store') && config.get('server.useBodyParser')) {
                        app.use('/', bodyParserMiddle, require(file)(express.Router()));
                    } else if (!~file.indexOf('.DS_Store')) {
                        app.use('/', require(file)(express.Router()));
                    }
                });

                finder.on('end', resolve);
            } else {
                console.warning('WARN'.inverse + ' ' + 'routers file is not exist'.magenta);
                resolve();
            }
        });
    });
};

/**
 * 导出bodyParser中间件
 */
module.exports.bodyParserMiddle = [bodyParser.urlencoded({
    extended: false
}), bodyParser.json()];
