var debug = require('debug')('chatbot');
var respoke = require('../api/respoke');

var chatbot = {};
var groups = {};
var connectionId = null;


function handleApplicationConnections(err, req, body) {
  if (err) debug(err);
  
  if (!body) {
    debug("application connections aint got no body!");
    return;
  }
  else {
    debug('application connections body', body);
  }
  var data = JSON.parse(body);
  if (data.length) {
    connectionId = data[0].id;
  }
  else {
    debug('no connections right now');
  }
  respoke.joinGroup('application', connectionId, ['robot'], handleJoinGroups);
}

function handleJoinGroups(err, req, body) {
  respoke.getMembers('people', handleGetPeople);
}

function handleGetPeople(err, req, body) {
  respoke.sendGroupMessage("people", "is online and listening to your every word...");
  var data = JSON.parse(body);
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    var msg = "I see " + item.endpointId + " connected on " + item.connectionId + ".";
    respoke.sendGroupMessage("people", msg);
  }
}


// Here are a list of events that we expect to come from the webhook
var events = {

  // endpoint message sent to the webhook endpoint ("application" in this case)
  "message": function (data) {
    debug('message from ' + data.header.from + ': ' + data.body);
  },
  
  // Process group messages
  "pubsub": function (data) {
    
    debug("group message on " + data.header.channel + " from " + data.header.from + ": " + data.message);
    
    // ignore any system messages
    if (data.header.from === "__SYSTEM__") return;
    
    // get or create an array for the messages
    var group = groups[data.header.channel];
    if (!group) {
      group = [];
      groups[data.header.channel] = group;
    }
    
    // look for history requests
    if (data.message == "/history") {
      console.dir(group);
      for (var i = 0; i < group.length; i++) {
        var message = group[i];
        var output = message.from + ": " + message.body;
        debug(output);
        respoke.sendMessage(data.header.from, output);
      }
      
      // break out now - no need to store commands
      return;
    }
    
    // create a new message object and store the important details
    var message = {};
    message.timestamp = data.header.timestamp;
    message.from = data.header.from;
    message.body = data.message;
    
    // add the message to the array
    group.push(message);
    
    // keep the message history to no more than 50 items
    if (group.length > 50) {
      group.shift();
    }
    
  },
  
  // system event - a new connection was established
  "endpointConnect": function (data) {
    debug('connect from: ' + data.endpointId);
    respoke.sendGroupMessage("people", data.endpointId + " just logged on.");
  },
  
  // system event - a connection terminated
  "endpointDisconnect": function (data) {
    debug('disconnect from ' + data.endpointId);
    respoke.sendGroupMessage("people", data.endpointId + " just logged off.");
  },
  
  // system event - a connection joined a group
  "groupJoined": function (data) {
    debug("event: " + data.endpointId + ' joined ' + data.group);
    
    // send the last 50 messages to the newly joined participant
  },
  
  // system event - a connection left a group
  "groupLeft": function (data) {
    debug("event: " + data.endpointId + ' left ' + data.group);
  },
  "join": function (data) {},
  "leave": function (data) {}
};

// the "process" method called by the express POST handler
chatbot.process = function (req) {
  debug('--------------------------------------------------------------------------------');

  try {
    // the event arrives in the request body
    var data = req.body;
    
    // if we have a valid request...
    if (data) {
    
      // if the events object has a matching method...
      if (events[data.header.type]) {
      
        // execute the method, passing in the event data
        events[data.header.type](data);
      
      } else {
      
        // otherwise log unrecognized events
        debug("Unrecognized Event:");
        console.dir(data);
      
      }
    }
  } catch(e) {
    debug("Error!: " + e);
  }
}

chatbot.getToken = function(endpointId, callback) {
  respoke.getToken(endpointId, callback);
};

// create a websocket connection for sending individual messages
respoke.createWebsocket();

// start by requesting the list of connections for the 'application' endpoint
respoke.getConnections('application', handleApplicationConnections);

module.exports = chatbot;