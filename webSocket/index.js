var util = require('util');
var eventEmitter = require('events').EventEmitter;

var socketIo = require('socket.io');

module.exports = function(server) {
    var thiz = this;
    eventEmitter.call(thiz);

    var io;
    var clients = []; // 客户端Socket集合，client.client.conn.remoteAddress属性可以获取Socket的IP地址

    var init = function(server) {
        io = socketIo(server);

        io.on('connection', function(client) {
            addClient(client);
        });
    };

    var addClient = function(client) {
        clients.push(client);
        thiz.emit('addClient', client);

        client.on('data', function(data) {
            thiz.emit('data', data, client);
        });

        client.on('disconnect', function() {
            deleteClient(client);
        });
    };

    var deleteClient = function(client) {
        clients.splice(clients.indexOf(client), 1);
        thiz.emit('deleteClient', client);
    };

    thiz.getClients = function() {
        return clients;
    };

    init(server);
};

util.inherits(module.exports, eventEmitter);
