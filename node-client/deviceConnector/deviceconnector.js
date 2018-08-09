var globalconfig;

var array = [];

var DeviceConnector = function (config) 
{
    globalconfig = config; // set new global config

    InstanceSelect(globalconfig.deviceinfo.protocol.name);
}


var SoapDeviceConnector = function (config)
{
    console.log("Start SOAP connector");

    var wsdl = globalconfig.deviceinfo.protocol.wsdl;
    var user = globalconfig.deviceinfo.protocol.user;
    var password = globalconfig.deviceinfo.protocol.password;
    var endpoint = globalconfig.deviceinfo.protocol.endpoint; 

    var request = {'smc:UserId': user, 'smc:Password': password}; 
    var options = {envelopeKey: 'soapenv', forceSoap12Headers: true}; 

    TaskClientCreate(request, wsdl, options, endpoint);
}

var TaskClientCreate = function(request ,wsdl, options, endpoint)
{
    var soap = require('soap');
    const interval = globalconfig.deviceinfo.protocol.interval;

    var createClient = function(endpoint){
        return new Promise(function(resolve, reject){
            soap.createClient(wsdl, options, function (err, client) {
                if (err){
                    reject(err);
                } else {
                    client.setEndpoint(endpoint);
                    resolve(client);
                }
            });
        });
    };
    
    var apiCall = function(client){
        return new Promise(function(resolve, reject){
            client.SystemStatus(request, function (err, result) {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    };
    
    createClient(endpoint).then(
        // manage the resolve
        function(client){
            setInterval( function() {
                apiCall(client).then(
                    //resolved
                    function(result){
                        console.log("TaskSchedule!");
                        CreateIndexElements(result);
                        MatchConfToServiceAndJSON(result);
                        //console.log(result);
                    },
                    //rejected
                    function(err){
                        console.log("error APIcall"); 
                    }
                )}, interval // every 1 sec
            ); 
        },
        //manage the reject
        function(err){
            console.log("error ClientCall");
        }
    );
}

var MatchConfToServiceAndJSON = function (pkt) 
{

    for (let i = 0; i < globalconfig.parameters.length; i++) 
    {
        for (var j = 0; j < array.length; j++) 
        {
            if (globalconfig.parameters[i].additionalinfo.baseid === array[j].BaseId) 
            {
                CreateJSON(globalconfig.parameters[i], array[j], pkt);
            } 
        }
    }
}

var CreateJSON = function (ParamConfig, Index, Pkt) 
{

    var Value = Pkt.MeasurementJobStatus[Index.j].CharacteristicValueStatus[Index.i].CurrentValue;
    var OriginUnit = Pkt.MeasurementJobStatus[Index.j].CharacteristicValueStatus[Index.i].Unit;
    var Timestamp = Pkt.MeasurementJobStatus[Index.j].CharacteristicValueStatus[Index.i].LastMeasurementTime;
    var Time = Date.now();

    Value = UnitConvert(ParamConfig.unit, OriginUnit, Value ); // controlla se l'unità di misura è uguale, altrimenti converte. può fare anche altri aggiustamenti vari
    Value = Approx(ParamConfig.decimal, Value );

    // formato dati ready to the cloud
    let data = {
        deviceid: globalconfig.deviceinfo.deviceid,
        groupdeviceid: globalconfig.deviceinfo.groupdeviceid,
        name: ParamConfig.name,
        unit: ParamConfig.unit,
        timestamp: Timestamp,
        value: Value,
        timerequest: Time, // opz
    }
    
    SendJSONData(data);
}


var SendJSONData = function (data) 
{
    var WebSocket = require('ws');
    var ws = new WebSocket("ws://localhost:1111");

    ws.on('message', function(message) {
    console.log('Received: ' + message);
    ws.send(JSON.stringify(data));
    });

    ws.on('close', function(code) {
    console.log('Disconnected: ' + code);
    });

    ws.on('error', function(error) {
    console.log('Error: ' + error.code);
    });
}

var InstanceSelect = function (protocolname) 
{
    switch(protocolname) 
    {
        case "SOAP":
            SoapDeviceConnector(globalconfig);
            break;
    }
} 


var CreateIndexElements = function (result)
{

    for (let j = 0; j < result.MeasurementJobStatus.length; j++)
    {   
        for (let i = 0; i < result.MeasurementJobStatus[j].CharacteristicValueStatus.length; i++)
        {
            var BaseId = result.MeasurementJobStatus[j].CharacteristicValueStatus[i].BaseId;
            array.push({BaseId: BaseId, j: j, i: i});
        }
    }
}

var Approx = function (num, value) 
{
    var tmp = parseFloat(value);
    var result = tmp.toFixed(num);
    return result;
}

var UnitConvert = function (dest, origin, value) 
{
    return value;
}

module.exports = DeviceConnector;