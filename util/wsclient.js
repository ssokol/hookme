/* global _:true */
'use strict';

/**
 * wsClient - websocket client for interacting with the collective API
 * this library was built to aid in testing the api. It is only marginally
 * implemented to support the specific initial use case, but can be built out
 * to support performing the many tasks the API exposes.
 */

var io = require('socket.io-client');
var _ = require('lodash');
var qs = require('querystring');
var events = require('events');
var util = require('util');
var assert = require('assert');

/**
 * Wrapper around socket.io to provide helper functions for interacting with the
 * collective API
 *
 * @param socket The connected socket.io socket.
 * @param token The token needed to make API requests.
 * @param tokenType The type of the token used to make API requests.
 * @augments events.EventEmitter
 * @fires ClientSocket#message indicator of an unsolicited message sent by the remote server.
 * @fires ClientSocket#join indicator of an endpoint joining a group the socket is subscribed to.
 * @fires ClientSocket#leave indicator of an endpoint leaving a group the socket is subscribed to.
 * @fires ClientSocket#announcement indicator of an announcment from the remote server.
 * @fires ClientSocket#pubsub indicator of an unsolicited message published to a group the socket is subscribed to.
 * @fires ClientSocket#disconnect indicates when the socket has been disconnected.
 * @fires ClientSocket#error indicates when an error has occurred on the socket.
 * @constructor
 */
function ClientSocket(socket, token, tokenType) {
    var self = this;

    events.EventEmitter.call(self);
    self.socket = socket;
    self.token = token;

    if (tokenType === 'appAuth') {
        self.tokenKey = 'App-Token';
    } else if (tokenType === 'appSecret') {
        self.tokenKey = 'App-Secret';
    } else if (tokenType === 'adminAuth') {
        self.tokenKey = 'Admin-Token';
    } else if (tokenType === 'sysAdminSecret') {
        self.tokenKey = 'System-Admin-Secret';
    } else {
        throw new TypeError('unknown tokenType: ' + tokenType);
    }

    ['message', 'presence', 'join', 'leave', 'announcement', 'pubsub', 'disconnect', 'error'].forEach(function (event) {
        self.socket.on(event, self.emit.bind(self, event));
    });
}

util.inherits(ClientSocket, events.EventEmitter);

/**
 * Helper to parse  a JSON API response from collective into either an error or response data.
 *
 * @param {string} response JSON-encoded response object from collective.
 * @returns {object} a parsed response object containing either an error or response data.
 * @private
 */
ClientSocket.prototype._interpretResponse = function (response) {
    var res = JSON.parse(response);

    if (res && res.error) {
        var error = new Error(res.error);
        error.body = res;
        return error;
    }

    return res;
};

/**
 * Helper to process a response from collective and pass the response to the appropriate callback param.
 *
 * @param {string} response JSON-encoded response object from collective.
 * @param {function} callback The node-style callback to be called once the response has been parsed.
 * @private
 */
ClientSocket.prototype._respond = function (response, callback) {
    var result = this._interpretResponse(response);

    if (result instanceof Error) {
        callback(result);
    } else {
        callback(null, result);
    }
};

/**
 * disconnect the underlying socket from collective.
 */
ClientSocket.prototype.disconnect = function (done) {
    // This used to be optional, so catch when someone omits it
    assert(done, 'Completion callback required');
    if (!this.isConnected()) {
        // already disconnected
        return done();
    }
    this.socket.once('disconnect', function () {
        done();
    });
    this.socket.disconnect();
};

/**
 * check if socket is connected
 */
ClientSocket.prototype.isConnected = function () {
    return this.socket.socket.connected;
};

/**
 * Helper to format a request message with the appropriate headers and format to make an API request to collective.
 *
 * @param {string} url The API endpoint to make the request against.
 * @param {object} [data] The data to be sent to the API endpoint, if applicable.
 * @returns {object} The constructed message.
 * @private
 */
ClientSocket.prototype._getSocketMessage = function (url, data) {
    var message = {
        url: url,
        headers: {}
    };

    if (data) {
        message.data = data;
    }

    message.headers[this.tokenKey] = this.token;
    return message;
};

/**
 * post a presence update over the websocket.
 *
 * @param data
 * @param callback
 */
ClientSocket.prototype.publishPresence = function (data, callback) {
    var path = '/v1/presence';

    this.executeRequest('post', path, data, callback);
};

/**
 * post a presence update over the websocket.
 *
 * @param data
 * @param callback
 */
ClientSocket.prototype.subscribePresence = function (data, callback) {
    var path = '/v1/presence-observers';

    this.executeRequest('post', path, data, callback);
};

/**
 * establish an endpoint in collective.
 *
 * @param {object} [data] Any parameters to be passed via the API.
 * @param {string} [data.endpointId] The endpoint id to use. Required if using App-Secret, Admin-Token, or Account Secret
 * @param {ClientSocket~requestCallback} callback The node-style callback to be called when the operation has completed.
 */
ClientSocket.prototype.establishEndpoint = function (data, callback) {
    var path = '/v1/connections';

    this.executeRequest('post', path, data, callback);
};

/**
 * subscribe an endpoint to a channel.
 *
 * @param {string} channel the channel to subscribe to.
 * @param {object|ClientSocket~requestCallback} [data] the data to be sent with the subscription request, if applicable. Otherwise, the callback.
 * @param {ClientSocket~requestCallback} callback The node-style callback to be called when the operation has completed.
 */
ClientSocket.prototype.subscribeEndpoint = function (channel, data, callback) {

    if (!channel) {
        throw new TypeError('channel is required');
    }

    var path = '/v1/channels/' + channel + '/subscribers';
    this.executeRequest('post', path, data, callback);
};

/**
 * unsubscribe an endpoint from a channel.
 *
 * @param {string} channel the channel to unsubscribe from
 * @param {object|ClientSocket~requestCallback} [data] the data to be sent with the unsubscribe request, if applicable. Otherwise, the callback.
 * @param {ClientSocket~requestCallback} callback The node-style callback to be called when the operation has completed.
 */
ClientSocket.prototype.unsubscribeEndpoint = function (channel, data, callback) {

    if (!channel) {
        throw new TypeError('channel is required');
    }

    var path = '/v1/channels/' + channel + '/subscribers';

    this.executeRequest('delete', path, data, callback);
};

/**
 * send a message to an endpoint.
 *
 * @param {object} data The data including `to` (an endpointId) and `message`.
 * @param {string} data.to The endpointId identifying the recipient of the message.
 * @param {string} data.message The message to send.
 * @param {ClientSocket~requestCallback} callback The node-style callback to be called when the operation has completed.
 */
ClientSocket.prototype.sendEndpointMessage = function (data, callback) {

    if (!data) {
        throw new TypeError("data (type: 'object') is required.");
    }

    if (!data.to) {
        throw new TypeError("data.to (type: 'string') is required. This is the endpointId of the recipient.");
    }

    if (!data.message) {
        throw new TypeError("data.message (type: 'string') is required. This is the message to send.");
    }

    var path = '/v1/messages';
    this.executeRequest('post', path, data, callback);
};

/**
 * send a message to a group.
 *
 * @param {string} group - the group to send to
 * @param {*} msg - The message to send
 * @param {ClientSocket~requestCallback} callback The node-style callback to be called when the operation has completed.
 */
ClientSocket.prototype.sendGroupMessage = function (group, msg, callback) {

    if (!group || !msg) {
        throw new Error("Must provide group and message.");
    }

    var path = '/v1/channels/' + group + '/publish';

    var data = {
        channel: group,
        message: msg
    };

    this.executeRequest('post', path, data, callback);
};

/**
 * send a signal.
 *
 * @param {object} data The data including `to` (an endpointId) and `signal`.
 * @param {string} data.to The endpointId identifying the recipient of the signal.
 * @param {object} data.signal The signal to send the recipient.
 * @param {ClientSocket~requestCallback} callback The node-style callback to be called when the operation has completed.
 */
ClientSocket.prototype.sendSignal = function (data, callback) {

    var path = '/v1/signaling';

    if (!data) {
        throw new TypeError("data (type: 'object') is required");
    }

    if (!data.to) {
        throw new TypeError("data.to (type: 'string') is required. This is the endpoint id of the recipient.");
    }

    if (!data.signal) {
        throw new TypeError("data.signal (type: 'object') is required. This is the actual signal to send.");
    }

    this.executeRequest('post', path, data, callback);
};


/**
 * Execute an arbitrary request on the socket.
 *
 * @param {string} method The HTTP method to use for the request
 * @param {string} path The path to the api endpoint relative to the base url (i.e. '/v1/connections')
 * @param {*} [data] The data to send along with the request, if required
 * @param {ClientSocket~requestCallback} callback The node-style callback to be called when the operation has completed.
 */
ClientSocket.prototype.executeRequest = function (method, path, data, callback) {
    var self = this;

    if (!callback && typeof(data) === 'function') {
        callback = data;
        data = null;
    }

    method = method.toLowerCase();

    if (['get', 'post', 'put', 'delete'].indexOf(method) === -1) {
        throw new TypeError("method must be one of ['get', 'post', 'put', 'delete']");
    }

    var message = self._getSocketMessage(path, data);
    self.socket.emit(method, JSON.stringify(message), function (res) {
        if (callback) {
            self._respond(res, callback);
        }
    });
};


/**
 * retrieve a socket.io connection to the specified host using the specified token
 *
 * @param {string} host the host to connect to
 * @param {string} token the token to use to connect
 * @param {string} tokenType the type of the token. ['appAuth', 'AppSecret', 'adminAuth']
 * @param {getSocketConnectionCallback} callback the function to call once the connection is ready. signature (err, ClientSocket)
 */
exports.getSocketConnection = function (host, token, tokenType, callback) {
    callback = _.once(callback);

    var tokenKey;
    if (tokenType === 'appAuth') {
        tokenKey = 'app-token';
    } else if (tokenType === 'appSecret') {
        tokenKey = 'app-secret';
    } else if (tokenType === 'adminAuth') {
        tokenKey = 'admin-token';
    } else if (tokenType === 'sysAdminSecret') {
        tokenKey = 'system-admin-secret';
    } else {
        throw new TypeError('unknown tokenType: ' + tokenType);
    }

    var auth = {};
    auth[tokenKey] = token;

    var url = host + '?' + qs.stringify(auth);
    var socket = io.connect(url, { 'force new connection': true });

    socket.on('connect', function () {
        socket.removeAllListeners('connect_failed');
        socket.removeAllListeners('error');
        callback(null, new ClientSocket(socket, token, tokenType));
    });

    socket.on('error', function (err) {
        socket.removeAllListeners('connect');
        socket.removeAllListeners('connect_failed');
        callback(err);
    });

    socket.on('connect_failed', function () {
        socket.removeAllListeners('connect');
        socket.removeAllListeners('error');
        callback(new Error('connection failed'));
    });
};

/**
 * This callback is called at the completion of a getSocketConnection call
 * @callback getSocketConnectionCallback
 * @param {object} error Any error that occurred while trying to connect to the remote server.
 * @param {ClientSocket} clientSocket the ClientSocket instance on successfully connection.
 */

/**
 * This callback is displayed as part of the ClientSocket class.
 * @callback ClientSocket~requestCallback
 * @param {object} error Any error that occurred during the request.
 * @param {object} response The response from the server
 */
