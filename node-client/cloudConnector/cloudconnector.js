
var globalcloudconfig;

var CloudConnector = function(cloudconfig)
{
    globalcloudconfig = cloudconfig;

    var localprot = globalcloudconfig.localside.protocol.name;
    LocalSideInstance(localprot);

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

    var WebSocketServer = require('ws').Server,
        wss = new WebSocketServer({port: _port}, {host: _host})

        console.log("WS: localside server is on");

        wss.on('connection', function connection(ws) {
            ws.isAlive = true;
            ws.on('pong', heartbeat);

            ws.on('message', function incoming(message) 
            {
                //create a JSON object
                var jsonObject = JSON.parse(message);
                console.log(`Roundtrip time: ${Date.now() - jsonObject.timerequest} ms`);

                // Now Send to Cloud !
                PublishonCloud(jsonObject);
            });

            try { ws.send(`${new Date()}`); }

            catch (e) { console.log("Exception, Send Error"); }
        });

    function noop() {}

    function heartbeat() 
    {
        this.isAlive = true;
    }

    const interval = setInterval(function ping() {
        wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) return ws.terminate();
        
        ws.isAlive = false;
        ws.ping(noop);
        });
    }, 30000);

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


var UbidotsConnectSettings = function(infocloud, datatosend)
{

    switch(infocloud.protocol.name) 
    {
        case "MQTT":

            var mqtt = require("mqtt");

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
    
}

module.exports = CloudConnector;