var fs = require('fs');
var path = require('path');

var config = require('config');
var less = require('less');
var lessPluginCleanCSS = require('less-plugin-clean-css');
var promise = require('bluebird');

/**
 * 生成静态公共样式文件
 */
module.exports.init = function() {
    return new promise(function(resol) {

        // 生成公共样式文件
        var generateCommonFile = function() {
            return new promise(function(res) {
                var chunk = '';
                var plugins = [];
                var lessConfig = config.get('server.less');
                var commonReferenceModule = config.get('server.browserify.commonReferenceModule');
                var ws = fs.createWriteStream(path.join(__dirname, './_.css'));

                if (lessConfig.customFile && lessConfig.customFile.length) {
                    lessConfig.customFile.forEach(function(p) {
                        if (path.extname(p) == '.less') {
                            chunk += '@import "' + p + '";';
                        } else {
                            chunk += '@import (inline) "' + p + '";';
                        }
                    });
                }

                commonReferenceModule.forEach(function(m) {
                    if (m.file) {
                        m.file.forEach(function(p) {
                            if (path.extname(p) == '.less') {
                                chunk += '@import "' + p + '";';
                            } else {
                                chunk += '@import (inline) "' + p + '";';
                            }
                        });
                    }
                });

                if (process.env.NODE_ENV == 'production') {
                    plugins.push(new lessPluginCleanCSS({
                        advanced: true
                    }));
                }

                less.render(chunk, {
                    plugins: plugins
                }, function(err, result) {
                    if (err) {
                        ws.write(err.message);
                    } else {
                        ws.write(result.css);
                    }
                    ws.close(res);
                });
            });
        };

        generateCommonFile().then(resol).done();
    });
};

/**
 * 当请求静态公共样式文件时，将样式文件以流的形式传送出去
 */
module.exports.getCommonFile = function(req, res) {
    res.set('Content-Type', 'text/css');
    fs.createReadStream(path.join(__dirname, './_.css')).pipe(res);
};
