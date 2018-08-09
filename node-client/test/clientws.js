    
var WebSocket = require('ws');
var ws = new WebSocket("ws://localhost:1111");

ws.on('message', function(message) {
  console.log('Received: ' + message);
});

ws.on('close', function(code) {
  console.log('Disconnected: ' + code);
});

ws.on('error', function(error) {
  console.log('Error: ' + error.code);
});