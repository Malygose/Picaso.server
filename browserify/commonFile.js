var fs = require('fs');
var path = require('path');

var async = require('async');
var browserify = require('browserify');
var config = require('config');
var factor = require('factor-bundle');
var promise = require('bluebird');
var utils = require('picaso.utils');

var writeContent = require('./writeContent');

/**
 * 非正式环境下的公共文件生成方法
 */
module.exports.generateInDevelop = function() {
    return new promise(function(res) {
        var filePath = path.join(__dirname, './_.js');
        var ws = fs.createWriteStream(filePath);
        async.waterfall([function(next) {
            async.forEachSeries(config.get('server.browserify.commonReferenceModule'), function(mod, next) {
                writeContent.writeContentWithModule(ws, mod, next);
            }, next);
        }, function(next) {
            writeContent.writeContentWithCustom(ws);
            browserify(filePath).bundle(next);
        }, function(res, next) {
            fs.writeFile(filePath, res, next);
        }], function(err) {
            ws.close();
            if (err) {
                fs.truncateSync(filePath, 0);
                fs.writeFileSync(filePath, utils.disposeBrowserifyError(err));
            }
            res();
        });
    });
};

/**
 * 正式环境下的公共文件生成方法
 */
module.exports.generateInProduction = function() {
    return new promise(function(res) {
        var backupPath = path.join(__dirname, './backup');
        var modules = [];

        // 创建多个子文件，每个模块一个文件
        var getContentWithModule = function(next) {
            var commonReferenceUrl = config.get('server.browserify.commonReferenceUrl');

            async.forEachSeries(formatCommonReferenceModule(config.get('server.browserify.commonReferenceModule')), function(mod, next) {
                var fileName = path.join(backupPath, mod.module + '-' + commonReferenceUrl.substring(commonReferenceUrl.lastIndexOf('/') + 1));
                modules.push(fileName);
                var ws = fs.createWriteStream(fileName);
                if (mod.included) {
                    writeContent.writeContentWithModule(ws, mod, function() {
                        async.forEachSeries(mod.included, function(m, next) {
                            writeContent.writeContentWithModule(ws, m, next);
                        }, next);
                    });
                } else {
                    writeContent.writeContentWithModule(ws, mod, next);
                }
            }, next);
        };

        // 将子文件进行browserify编译
        var browseSubFile = function(next) {
            var b = browserify(modules);
            b.plugin(factor, {
                outputs: modules
            });
            b.bundle(next);
        };

        // 将所有子文件引入到主文件
        var browseMainFile = function(err, next) {
            var commonReferenceUrl = config.get('server.browserify.commonReferenceUrl');
            var suffix = commonReferenceUrl.substring(commonReferenceUrl.lastIndexOf('/') + 1);
            var backupPath = path.join(__dirname, './backup');
            var ws = fs.createWriteStream(path.join(__dirname, './_.js'));

            fs.readdir(backupPath, function(err, files) {
                ws.write('var script, heads;\n\n');
                files.forEach(function(f) {
                    if (!!~f.indexOf(suffix)) {
                        ws.write('script = document.createElement(\'script\');\n');
                        ws.write('script.setAttribute(\'type\', \'text/javascript\');\n');
                        ws.write('script.setAttribute(\'src\', \'' + f + '\');\n');
                        ws.write('heads = document.getElementsByTagName(\'head\');\n');
                        ws.write('if(heads.length) heads[0].appendChild(script); else document.documentElement.appendChild(script);\n\n');
                    }
                });
                writeContent.writeContentWithCustom(ws);

                next();
            });
        };

        async.waterfall([getContentWithModule, browseSubFile, browseMainFile], res);
    });
};

/**
 * 整合所有引用的模块，整合引入与被引入
 * 以目前的情况来看，此方法并非最优方案，推荐以requireJs方法进行解决
 */
function formatCommonReferenceModule(modules) {
    var res = {};

    modules.forEach(function(mod) {
        if (!mod.included) {
            res[mod.module] = mod;
        }
    });

    modules.forEach(function(mod) {
        if (mod.included instanceof Array && mod.included.length) {
            if (!res[mod.included[0]].included) res[mod.included[0]].included = [];
            res[mod.included[0]].included.push(mod);
        } else if (mod.included && typeof mod.included == 'string') {
            if (!res[mod.included].included) res[mod.included].included = [];
            res[mod.included].included.push(mod);
        }
    });

    return res;
}
