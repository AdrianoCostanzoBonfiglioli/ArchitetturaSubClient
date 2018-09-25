const WebSocket = require('ws');
var mqtt = require("mqtt");
var Client = require('node-rest-client').Client;

var globalcloudconfig;
var RESTclient;

var CloudConnector = function(cloudconfig)
{
    globalcloudconfig = cloudconfig;

    var localprot = globalcloudconfig.localside.protocol.name;

    LocalSideInstance(localprot);

    // Client REST create.
    RESTclient = new Client(); // lo creo adesso ed una sola volta!

    RESTclient.on('error', function (err) {
        console.log('something went wrong on REST Request!!', err.request.options);
    });

    RESTclient.on('responseTimeout', function (res) {
        console.log("response has expired");
    });

}

var LocalSideInstance = function (protocolname) 
{
    switch(protocolname) 
    {
        case "WebSocket":
            var host = globalcloudconfig.localside.protocol.host;
            var port = globalcloudconfig.localside.protocol.port;
            WebSocketConnect(host, port);

            break;
    }
}

var WebSocketConnect = function(_host, _port,)
{

    const wss = new WebSocket.Server({port: _port}, {host: _host});

    console.log("WS: localside server is on");

    wss.on('connection', function connection(ws) {
        ws.on('message', function incoming(message) {
            var jsonObject = JSON.parse(message);

            // Now Send to Cloud !
            PublishonCloud(jsonObject);
        });

    });

}


// Cloud functions

var PublishonCloud = function(datatosend)
{
    for (let i = 0; i < globalcloudconfig.cloudside.length; i++) 
        {
            CloudSideInstance (globalcloudconfig.cloudside[i], datatosend);
        }
}


var CloudSideInstance = function (infocloud, datatosend) 
{

    switch(infocloud.name) 
    {
        case "Ubidots01":
            UbidotsConnectSettings(infocloud, datatosend);
            break;
    }
}

/* Data Model Schema Reference !
    let data = {
        deviceid: globalconfig.deviceinfo.deviceid,
        groupdeviceid: globalconfig.deviceinfo.groupdeviceid,
        category: ParamConfig.category,
        name: ParamConfig.name,
        unit: ParamConfig.unit,
        value: Value,
        timestamp: timeDATE,
        timestampINT: timeINT 
    }
*/

var UbidotsConnectSettings = function(infocloud, datatosend)
{

    switch(infocloud.protocol.type) 
    {
        case "MQTT":
        {

            var token = infocloud.protocol.token;
            var host = infocloud.protocol.host;
            var qos = infocloud.protocol.qos;
            var retain = infocloud.protocol.retain;
            
            // Connect with MQTT
            var client = mqtt.connect(
                host,
                {
                    username: token,
                    password: ''
                });

            var deviceLabel = datatosend.deviceid;

            client.publish("/v1.6/devices/" + deviceLabel, datatosend, { 'qos': qos, 'retain': retain },
                function (error, response) {
                    console.log(response);
                });

            console.log("Send PKT to the Cloud");

        break;
        }

        case "RESTAPI":
        {

        // Info Host / Token
        var token = infocloud.protocol.token; 
        var host = infocloud.protocol.host; 
        var apiversion = infocloud.protocol.apiversion; 

        // Label
        var parametername = datatosend.name;

        // Value
        var value = datatosend.value;
        var timestampInteger = datatosend.timestampINT;

        // Context
        var deviceid = datatosend.deviceid;
        var groupdeviceid = datatosend.deviceid;
        var category = datatosend.category;
        var unit = datatosend.unit;

        var request = "http://"+ host +"/api/"+ apiversion +"/devices/"+ deviceid +"/" + parametername + "/values?token=" + token;

        console.log(request);

        //Ubidots JSON Format
        var dataready = { 
            "value" : value,
            "context" : { "unit": unit, "deviceid" : deviceid, "groupdeviceid" : groupdeviceid, "category" : category},
            "timestamp": timestampInteger,
        }

        console.log(dataready);

        var args = {
            data: dataready,
            headers: { "Content-Type": "application/json" }
        };
        
        // registering remote methods
        RESTclient.registerMethod("postMethod", request, "POST");
        
        RESTclient.methods.postMethod(args, function (data, response) {
            console.log(data);
            //console.log(response);             // raw response
        });

        console.log("Send PKT to the Cloud");

        break;
        }


        default:
        break;
    }
    
}

module.exports = CloudConnector;