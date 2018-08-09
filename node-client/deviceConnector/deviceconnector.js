var globalconfig;

var array = [];

var DeviceConnector = function (config) 
{

    console.log("connector start");

        // solo per cancellare il file
        const fs = require('fs');
        fs.writeFile('ReadyToPutIntoTheCloud.txt', "Start new Reqeust istance... \n", (err) => {  
            if (err) throw err;
            console.log('New File Create');
        });

    globalconfig = config; // set new global config

    console.log(globalconfig.deviceinfo.protocol.name);
    InstanceSelect(globalconfig.deviceinfo.protocol.name);
}


var SoapDeviceConnector = function (config)
{
    /*
        "wsdl": "http://10.1.154.14:10080/wsdl/smartcheck_status_201601.wsdl",
        "endpoint": "http://10.1.154.14:10080/smcstatus"

        C è un port forwarding sulla macchina 10.1.154.14
        CMD WIN-> netsh interface portproxy add v4tov4 listenport=10080 listenaddress=0.0.0.0 connectport=80 connectaddress=10.1.71.100 
    */
    console.log("Start SOAP connector");

    var wsdl = globalconfig.deviceinfo.protocol.wsdl; //get wsdl file
    var user = globalconfig.deviceinfo.protocol.user;
    var password = globalconfig.deviceinfo.protocol.password;
    var endpoint = globalconfig.deviceinfo.protocol.endpoint; 

    var request = {'smc:UserId': user, 'smc:Password': password}; //set service input parameters following the documentation (just user and pwd in this case)
    var options = {envelopeKey: 'soapenv', forceSoap12Headers: true}; //override some properties to have the request working on FAG

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
        timerequest: Time,
    }
    
    SendJSONData(data);

    // DBG
    let datafile = JSON.stringify(data, null, 2);

    const fs = require('fs');
    fs.appendFile('ReadyToPutIntoTheCloud.txt', datafile, (err) => {  
        if (err) throw err;
        console.log('Data written to file');
    });  
}


var SendJSONData = function (data, ) 
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
        case "Orange":
            text = "I am not a fan of orange.";
            break;
        case "Apple":
            text = "How you like them apples?";
            break;
        default:
            text = "I have never heard of that fruit...";
    }
} 


var CreateIndexElements = function (result)
{

    for (let j = 0; j < result.MeasurementJobStatus.length; j++)
    {   
        for (let i = 0; i < result.MeasurementJobStatus[j].CharacteristicValueStatus.length; i++)
        {
            
            //console.log(result.MeasurementJobStatus[j].CharacteristicValueStatus[i]); //DBG momentaneo

            var BaseId = result.MeasurementJobStatus[j].CharacteristicValueStatus[i].BaseId;
            array.push({BaseId: BaseId, j: j, i: i});

            //DBG
            //console.log(BaseId);
            //console.log("-----");
        }
    }

    //debug
    //for (var i = 0; i < array.length; i++) 
        //console.log(array[i]);

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