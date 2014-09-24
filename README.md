## WebHook Demo

# What This Is

This simple node.js + express application demonstrates how to use the webhook feature 
of Respoke to integrate a server-side application. It uses the default webhook created 
through the developer console. (This webhook is automatically assigned the endpointId 
of "application".)

# What This Does

1. It handles brokered authentication. The server component includes a /token route that 
the client calls to fetch an access token. The server makes a REST call to Respoke to 
fetch the token.

2. It serves up static content from the 'public' folder, which includes a very simple 
demo client application.

3. It listens for messages sent to the "robot" group and keeps a history of the last 
50 messages. The client app automatically copies "robot" on every message it sends. 
The robot stores the history and can replay it. The client automatically retrieves the 
history when it connects. Users can manually request the history by sending "/history" 
from the text input box.

# Setting It Up

* Create A New Respoke App

In the Respoke developer console, create a new application. Call it whatever you like. 
Set the "Development Mode" switch to "off". Note the "Application ID" value. You'll need 
that momentarily.

* Install The Sample Project

Clone the project onto a publicly available server with a current version of node.js 
and npm. You'll need to make sure that port 3000 is open and reachable from the Internet.

Change directories into the 'hookme' directory.

Install dependencies using 'npm install'

Change directories into the 'controllers' directory. 

Edit the 'chatbot.js' file. Towards the bottom of the file you'll find two lines that you 
will need to edit: one for the appId and one for the appSecret. Replace the placeholder 
values with you Application ID and Application Secret values;

Start the server using 'npm start'

* Configure Your Respoke App

Set the "WebHook URL" to point to your server. 

  http://your.server.com:3000/
  
Note the ":3000" at the end of the URL. You'll need that, as the sample runs on port 
3000 by default. You can, of course, change that if you want.

# Testing It Out

To test it out, fire up a web browser and point it to your server. Remember to add the 
port number (:3000) to the URL. You should see the simple client login screen appear.

Log in using whatever name you want. Now do the same thing again from another browser 
tab (or from another computer). Enter the name you used on the first browser tab in the 
"Place a call or send a message to:" box. Then enter a message and hit <enter>.

You should see the message appear in the first browser tab. Repeat the process to 
send messages back to the second browser tab from the first. To get a history of messages 
just type "/history" (no quotes) and it <enter>

# Files & Stuff

If you're familiar with express, you should recognize most of what's included. The 
main file for the application is app.js which contains a virtually default express 
configuration.

* /routes/index.js

The routing in this example is handled by a the 'index.js' file in the 'routes' folder. 
The default index.js was modified to require the chatbot controller and to add a handler 
for POST requests.

* /controllers/chatbot.js

The chatbot.js file is where most of the action takes place:

- process token requests from the client
- process events from the webhook
- store message history for any message sent to the 'robot' group
- sends out the history upon request


* /api/respoke.js and /api/wsclient.js

These files handle the process of formatting and passing REST requests to Respoke. In 
general, all of the exposed functions expect the caller to include a callback parameter 
that receives three return values: error (hopefully null), response (the complete response 
object) and body (the actual returned data)

# Next Steps

This is just a sample. You could easily improve on it by:

- Using a database instead of an array
- Sending a more detailed message to the 'robot' group with the 'to' message so the 
history can be sorted by recipient
- all kinds of error handling!
