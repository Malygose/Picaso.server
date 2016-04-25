var config = require('config');
var utils = require('picaso.utils');

/**
 * 写入require模块
 */
module.exports.writeContentWithModule = function(ws, mod, next) {
    if (typeof mod.shim == 'object' && mod.shim instanceof Array && mod.shim.length) {
        mod.shim.forEach(function(o) {
            ws.write('window.' + o + ' = ');
        });
    } else if (mod.shim && typeof mod.shim == 'string') {
        ws.write('window.' + mod.shim + ' = ');
    }

    if (mod.shim && mod.require) {
        ws.write('require(\'' + mod.require + '\');');
    } else if (mod.module) {
        ws.write('require(\'' + mod.module + '\');');
    }
    next();
};

/**
 * 写入自定义内容
 */
module.exports.writeContentWithCustom = function(ws) {
    if (process.env.NODE_ENV != 'production') {
        // 与服务器进行通信
        ws.write('window.socket = socket(\'http://' + utils.getRemoteIP() + ':' + config.get('server.port') + '\');');
        // 监听css文件变化
        ws.write('socket.on(\'data\', function(data) {$(\'link\').each(function() {if ($(this).attr(\'href\') == data || !!~$(this).attr(\'href\').indexOf(data + \'?\')) {$(this).attr(\'href\', data + \'?\' + Date.now());}});});');
    } else if (config.get('server.useSocket')) {
        ws.write('window.socket = socket(\'http://' + utils.getRemoteIP() + ':' + config.get('server.port') + '\');');
    }
    if (process.env.NODE_ENV == 'production') ws.write('window.env = \'production\';');
};
