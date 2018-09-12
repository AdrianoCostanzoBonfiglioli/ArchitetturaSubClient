var globalconfig;

const Influx = require('influx');

exports.PushRAWData = function(ppconfig)
{
    globalconfig = ppconfig;
    console.log("pushmodule...");
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
                console.log("PKT from: " + jsonObject.deviceid);
                console.log("PKT label: " + jsonObject.name);
                console.log(`Roundtrip time: ${Date.now() - jsonObject.timestampINT} ms`);

                // Now Send to Cloud !
                PushDataOnDB(jsonObject);
            });

            // ACK 
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


var PushDataOnDB = function(jsonObject)
{
    //console.log(jsonObject); //DBG

    databaselabel = "RawDataDb01"

    value = jsonObject.value
    measurement = jsonObject.name

    tag_deviceid = jsonObject.deviceid
    tag_groupdeviceid = jsonObject.groupdeviceid
    tag_category = jsonObject.category
    tag_unit = jsonObject.unit

    var timestamp = jsonObject.timestamp;
    var timestampINT = jsonObject.timestampINT;

    const influx = new Influx.InfluxDB({
    host: 'localhost',
    database: databaselabel,
    port: 8086,
    username: 'root',
    password: '',
    schema: 
    [{
        measurement: measurement,
        fields: 
        {
            value: Influx.FieldType.FLOAT,
        },
        tags: [ 'deviceid','groupdeviceid','category','unit' ]
    }]

})

influx.writePoints([
  {
    measurement: measurement,
    tags: { deviceid : tag_deviceid, groupdeviceid: tag_groupdeviceid, category : tag_category, unit : tag_unit },
    fields: { value: value },
    timestamp: timestampINT,
  }
],{ precision: 'ms', database: databaselabel } 
).catch(function(err) {
    console.log('Caught an error!', err);
});


}