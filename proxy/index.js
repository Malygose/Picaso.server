var url = require('url');

var config = require('config');
var httpProxy = require('http-proxy');

var cfg = config.get('server.proxy');
var proxy = httpProxy.createProxyServer(cfg.config);

var cls = require('geronimo.utils').console;

/**
 * 将请求传送给代理，由代理完成下面步骤
 */
module.exports = function(req, res) {
    (function(req, res) {
        console.log('proxy'.cyan + ' ' + req.method + ' ' + url.resolve(cfg.target, req.baseUrl.substring('1')) + req.url);
        proxy.web(req, res, {
            target: url.resolve(cfg.target, req.baseUrl.substring('1'))
        }, function(err, req, res) {
            if (err) {
                res.status(500).send(err.message);
            }
        });
    })(req, res);
};
