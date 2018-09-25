var globalconfig;
var influx;

const Influx = require('influx');
const WebSocket = require('ws');

exports.PushRAWData = function(config)
{
    globalconfig = config;
    console.log("pushmodule...");

    InfluxInstance(); 
    LocalSide(); // Server Instance
};

exports.PullRAWData = function(ppconfig)
{
    globalconfig = ppconfig;
    console.log("pullmodule...");
};


var LocalSide = function () 
{
    protocol = globalconfig.localside.interface;

    switch(protocol.name) 
    {
        case "WebSocket":
            var host = protocol.host;
            var port = protocol.port;
            WebSocketServer(host, port);
            break;
    }
}

var WebSocketServer = function(_host, _port,)
{
    const wss = new WebSocket.Server({port: _port}, {host: _host});
    console.log("WS: localside server is on");

    wss.on('connection', function connection(ws){
        ws.on('message', function incoming(message) 
        {
            //create a JSON object
            var jsonObject = JSON.parse(message);
            console.log("PKT from: " + jsonObject.deviceid);
            console.log("PKT label: " + jsonObject.name);

            // Now Send to Cloud !
            PushDataOnDB(jsonObject);
        });
    });
}

var InfluxInstance= function()
{
    databaselabel = "RawDataDb01"

    influx = new Influx.InfluxDB({
        host: 'localhost',
        database: databaselabel,
        port: 8086,
        username: 'root',
        password: '',
    })
}

var PushDataOnDB = function(jsonObject)
{
    //console.log(jsonObject); //DBG

    databaselabel = "RawDataDb01"

    value = Number(jsonObject.value)
    measurement = jsonObject.name

    tag_deviceid = jsonObject.deviceid
    tag_groupdeviceid = jsonObject.groupdeviceid
    tag_category = jsonObject.category
    tag_unit = jsonObject.unit

    var timestamp = jsonObject.timestamp;
    var timestampINT = jsonObject.timestampINT;

influx.writePoints([
  {
    measurement: measurement,
    tags: { deviceid : tag_deviceid, groupdeviceid: tag_groupdeviceid, category : tag_category, unit : tag_unit },
    fields: { value: value },
    timestamp: timestampINT,
  }
],{ precision: 'ms', retentionPolicy: 'autogen', database: databaselabel, 
schema: [{
    measurement: measurement,
    fields: 
    {
        value: Influx.FieldType.FLOAT,
    },
    tags: [ 'deviceid','groupdeviceid','category','unit' ]
}] }
).catch(function(err) {
    console.log('Caught an error!', err);
});


}