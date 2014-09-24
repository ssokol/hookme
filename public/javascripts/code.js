var call = null;
var endpoint = null;
var appId = "9d6d4abf-b1e2-4d8e-b553-be9f68bbb824";
var callTimer = null;
var e = null;

var people = null; // people group
var robot = null; // robot group

respoke.log.setLevel('debug');


var onConnected = function() {
    $("#connect").css("display", "none");
    $("#login").css("display", "none");
    
    $("#disconnect").css("display", "block");
    $("#makeCalls").css("display", "block");
    
    e = client.getEndpoint({id: "steve"});
    e.listen("presence", function(evt) {
        console.log("Presence Event --->>>>");
        console.dir(e); 
    });
    e.getPresence();
    
    // join the group to listen in on
    client.join({
        "id": "people",
        "onSuccess": function(evt) {
            people = evt;
            people.listen('message', function(evt) {
                console.log("group-level message");
                console.dir(evt);
                addMessage("(rbot) " + evt.message.message);
            });
        }
    });
    
    // grab a reference to the group to which we publish
    // NOTE: getGroup does not work - does not return a group object!!!!
    client.join({
        "id": "robot",
        "onSuccess": function(g) {
            robot = g;   
        }
    });
};

var onDisconnected = function() {
    console.log("Disconnected!");
    $("#connect").css("display", "block");
    $("#disconnect").css("display", "none");
};

var onHangup = function(evt) {
    console.log("Hangup!");
    $("#modal").css("display", "none");
    $("#callButton").css("display", "block");
    $("#hangupButton").css("display", "none");
    call = null;    
};

// incoming call handler - WHY IS THIS CALLED FOR OUTGOING CALLS?
var onCall = function(evt) {
    
    call = evt.call;
    call.listen("hangup", onHangup);
    $("#callButton").css("display", "none");
    $("#hangupButton").css("display", "block");
    
    if (call.caller == true) return;
    
    console.log("Incoming Call!");
    console.log(call);
    console.log(call.hasVideo);
    console.log(call.hasAudio)
    
    // now open the answer / ignore dialog
    console.dir(call.remoteEndpoint.id);
    $("#fromName").html(call.remoteEndpoint.id);
    $("#modal").css("display", "block");
    
}

var onEndpointMessage = function(evt) {
    console.log("endpoint message: ");
    console.dir(evt);
};

var addMessage = function(msg, local) {
    var mb = $("#messageBox");
    var classes = "message";
    if (local === true) classes += " local";
    var m = "<div class='" + classes + "'>" + msg + "</div>\n";
    mb.append(m);
    mb.scrollTop(mb[0].scrollHeight);
}

var onAnswer = function(evt) {
    if (callTimer) {
        window.clearTimeout(callTimer);
        callTimer = null;
    }
    // hide the modal display
    $("#modalOutgoing").css("display", "none");
}

var onMessage = function(evt) {
    console.log("client-level message");
    console.dir(evt);
    
    // ignore group messages - we handle them at the group level
    if (evt.group) return;
    
    if (!endpoint) {
        if (!evt.message.endpointId == "__SYSTEM__") {
            endpoint = client.getEndpoint({"id": evt.message.endpointId});
            endpoint.listen("message", onEndpointMessage);
            $("#epToCall").val(evt.message.endpointId);
        }
    }

    // try to parse the message as JSON
    try {
        var j = JSON.parse(evt.message.message);
        if (j) {
            var val = j.val + 1;
            if (val >= 13) {
                var now = new Date().getTime();
                var diff = (parseFloat(now - j.now) / 1000);
                alert("done: " + diff + " seconds");
            } else {
                j.val = val;
                endpoint.sendMessage({"message": JSON.stringify(j)});
            }
        }
    } catch(e) {
        
    }
    
    addMessage(evt.message.message);
};

var onError = function(e) {
    $("#foo").html(JSON.stringify(e)); 
};

$("#counterButton").click(function() {
    var epToCall = $("#epToCall").val();
    if (!epToCall) return;
    
    var now = new Date().getTime();
    var j = {"now": now, "val": 0};
    
    endpoint = client.getEndpoint({"id": epToCall});
    endpoint.sendMessage({"message": JSON.stringify(j)});
});

$("#answerButton").click(function() {
    if (!call) return;
    var constraints = {
        "video": call.hasVideo || false,
        "audio": call.hasAudio || true,
        optional: [],
        mandatory: {}
    };
    console.log(constraints);
    call.answer({"constraints": constraints}); 
    $("#modal").css("display", "none");
});

$("#ignoreButton").click(function() {
    if (!call) return;
    call.reject();
    $("#modal").css("display", "none");
});

$("#callButton").click(function() {
    var epToCall = $("#epToCall").val();
    var params = {
        "endpointId": epToCall,
        "constraints": {
            video : false,
            audio : true,
            optional: [],
            mandatory: {}
        }
    }
    call = client.startCall(params);
    call.listen("hangup", onHangup);
    call.listen("answer", onAnswer);
    if (call) {
        callTimer = window.setTimeout(function(evt) {
            call.hangup();
        }, 10000);
    }
    console.log("Outgoing Call!");
    console.dir(call);
});

$("#hangupButton").click(function() {
    if (call) {
        call.hangup();
    }
});

var sendMessage = function() {
    var epToCall = $("#epToCall").val();
    var msgToSend = $("#messageText").val();
    
    endpoint = client.getEndpoint({"id": epToCall});
    endpoint.sendMessage({"message": msgToSend});
    robot.sendMessage({"message": msgToSend});
    
    addMessage(msgToSend, true);
    $("#messageText").val("");
    $("#messageText").focus();
}

$("#messageButton").click(function() {
    sendMessage();
});

$("#messageText").keyup(function (e) {
    if (e.keyCode == 13) {
        sendMessage();
    }
});

$("#connect").click(function() {
    var epid = $("#endpoint").val();
    if (!epid) return;
    
    // get a token from the server
    $.post("/token/", {'endpointId': epid}).done(function(data){
      data = JSON.parse(data);
console.dir(data);
      // use the token to connect the client to respoke
      client.connect({
        token: data.tokenId,
        onDisconnect: onDisconnected,
        onSuccess: onConnected,
        onError: onError,
        onCall: onCall
      });
    });
});

$("#disconnect").click(function() {
    client.disconnect(); 
});

var client = new respoke.createClient({
    appId: appId,
    baseURL: "https://api-st.respoke.io",
    //developmentMode: true
});

client.listen("message", onMessage);

// fetch a token from the server