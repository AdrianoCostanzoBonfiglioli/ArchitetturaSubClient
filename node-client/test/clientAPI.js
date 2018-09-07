var Client = require('node-rest-client').Client;
 
var client = new Client();
 
// set content-type header and data as json in args parameter
var args = {
    data: {"value":11.21, "context":{"lat":1.12, "lng":2.019}, "timestamp":1000199992},
    headers: { "Content-Type": "application/json" }
};
 
client.post("http://things.ubidots.com/api/v1.6/devices/lora-device/temperature/values?token=BBFF-42n4eJAyj1fQQeGtgo57vnuxUKlf9D", args, function (data, response) {

    console.log(data);

    console.log(response);
});
 
// registering remote methods
client.registerMethod("postMethod", "http://things.ubidots.com/api/v1.6/devices/lora-device/temperature/values?token=BBFF-42n4eJAyj1fQQeGtgo57vnuxUKlf9D", "POST");
 
client.methods.postMethod(args, function (data, response) {
    // parsed response body as js object
    console.log(data);
    // raw response
    console.log(response);
});