var globalconfig;

var DeviceConnector = function (config) 
{
    globalconfig = config; // set new global config
    InstanceSelect(globalconfig.deviceinfo.protocol.name);
}


var SoapDeviceConnector = function (config)
{
    console.log(globalconfig.deviceinfo.deviceid + ": Start SOAP connector");

    var user = globalconfig.deviceinfo.protocol.user;
    var password = globalconfig.deviceinfo.protocol.password;
    var host = globalconfig.deviceinfo.protocol.host;

    var wsdl = "http://" + host + globalconfig.deviceinfo.protocol.wsdl ;
    var endpoint = "http://" + host + globalconfig.deviceinfo.protocol.endpoint; 

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
                        console.log(globalconfig.deviceinfo.deviceid + ": TaskSchedule");
                        MatchConfToServiceAndJSON(result);
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

    var arrayIndex = [];
    var NoEntry = 0;

    // create arrey baseID and index

    for (let j = 0; j < pkt.MeasurementJobStatus.length; j++)
    {   
        for (let i = 0; i < pkt.MeasurementJobStatus[j].CharacteristicValueStatus.length; i++)
        {
            var BaseId = pkt.MeasurementJobStatus[j].CharacteristicValueStatus[i].BaseId;
            arrayIndex.push({BaseId: BaseId, j: j, i: i});
        }
    }

    for (let i = 0; i < globalconfig.parameters.length; i++) 
    {
        for (var j = 0; j < arrayIndex.length; j++) 
        {
            if (globalconfig.parameters[i].additionalinfo.baseid === arrayIndex[j].BaseId) 
            {
                CreateJSON(globalconfig.parameters[i], arrayIndex[j], pkt);
                console.log(globalconfig.deviceinfo.deviceid + ": PKT JSON Created !");
                NoEntry = 1;
            } 
        }
    }

    if (NoEntry == 0)
        console.log(globalconfig.deviceinfo.deviceid + ": No Match between JSON and SOAP PKT, check correct baseID parameters");
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
    // THIS IS SO IMPORTANT - DATA MODEL !
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
    var InstanceMax = globalconfig.interfacesinfo.length;

    for (let i = 0; i < InstanceMax; i++) 
    {

        var protocol = globalconfig.interfacesinfo[i].info.protocol;
        var config = globalconfig.interfacesinfo[i];

        switch(protocol) 
        {
            case "WS":
                WSInstance(data, config);
            break;

            case "FILE":
                FILEInstance(data, config);
            break;

            default:
            break;
        }
    }
}

var WSInstance = function(data, config)
{
    var WebSocket = require('ws');

    var name = config.name;
    var host = config.info.host;
    var port = config.info.port;

    var url = 'ws://' + host + ':' + port;

    var ws = new WebSocket(url);

    ws.on('message', function(message) {
    console.log(name +' Received: ' + message);
    ws.send(JSON.stringify(data));
    });

    ws.on('close', function(code) {
    console.log(name +' Disconnected: ' + code);
    });

    ws.on('error', function(error) {
    console.log(name +' Error: ' + error.code);
    });
}

var FILEInstance = function(data, config)
{
    const fs = require('fs');
    const content = JSON.stringify(data);
    
    fs.appendFileSync(config.info.path, content, 'utf8', function (err) {
        if (err) {
            return console.log(err);
        }
    
        console.log("The file was saved!");
    }); 

}

var InstanceSelect = function (protocolname) 
{
    switch(protocolname) 
    {
        case "SOAP":
            SoapDeviceConnector(globalconfig);
            break;

        case "MODBUS_INVERTER":
            SoapDeviceConnector(globalconfig); // ModbusDeviceConnector(globalconfig, type); // Inverter type
            break;
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