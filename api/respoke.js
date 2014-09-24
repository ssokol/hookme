var request = require('request');
var wsClient = require('../util/wsclient');
var clientSocket = null;

var respoke = {};

respoke.appSecret = null;
respoke.appId = null;

var genericHandler = function(err, req, body) {
  if (err) {
    console.log(err);
  }
};

// fetch a token from respoke.
respoke.getToken = function(endpointId, callback) {
  
  var body = {
    "appId": respoke.appId,
    "endpointId": endpointId,
    "ttl": 86400
  };

  request.post({
    'url': 'https://api-st.respoke.io/v1/tokens',
    'headers': {'App-Secret': respoke.appSecret},
    'body': JSON.stringify(body)
  }, callback);
};

// send group messages
respoke.sendGroupMessage = function (group, message, callback) {
    var handler = callback || genericHandler;
    
    if (clientSocket) {
      clientSocket.sendGroupMessage(group, message, handler);
    } else {
      request.post({
        'url': 'https://api-st.respoke.io/v1/channels/' + group + '/publish',
        'headers': {'App-Secret': respoke.appSecret},
        'body': JSON.stringify({"message": message})
      }, handler);
    }
}

// send endpoint messages
// NOTE: this is using the clientSocket because the current incarnation of the respoke
// back-end does not allow messages on HTTPS
respoke.sendMessage = function (endpoint, message, callback) {
  var handler = callback || genericHandler;
  var msg = {};
  msg.to = endpoint;
  msg.message = message;
  clientSocket.sendEndpointMessage(msg, handler);
};

// return a list of connections for an endpoint
respoke.getConnections = function (endpoint, callback) {
  var handler = callback || genericHandler;
  request.get({
    'url': 'https://api-st.respoke.io/v1/apps/' + respoke.appId + '/endpoints/' + endpoint + '/connections',
    'headers': {'App-Secret': respoke.appSecret}
  }, handler);
};

// add a connection to one or more group(s)
respoke.joinGroup = function (endpoint, connection, groups, callback) {
  var handler = callback || genericHandler;
  request.put({
    'url': 'https://api-st.respoke.io/v1/apps/' + respoke.appId + '/endpoints/' + endpoint + '/connections/' + connection,
    'headers': {'App-Secret': respoke.appSecret},
    'body': JSON.stringify({"groups": groups})
  }, handler); 
};

// return a list of group members (subscribers)
respoke.getMembers = function (group, callback) {
  var handler = callback || genericHandler;
  request.get({
    'url': 'https://api-st.respoke.io/v1/channels/' + group + '/subscribers/',
    'headers': {'App-Secret': respoke.appSecret}
  }, handler);
};

// create a websocket connection
respoke.createWebsocket = function() {
  wsClient.getSocketConnection("https://api-st.respoke.io", respoke.appSecret, "appSecret", function(err, socket) {
    if (err) {
      console.log(err);
    } else {
      clientSocket = socket;
      console.log("Application-level WebSocket connection established to Respoke.");
    }
  });
};

module.exports = respoke;