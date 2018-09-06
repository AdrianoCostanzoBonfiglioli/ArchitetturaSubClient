var globalconfig;

var DeviceConnector = function (config) 
{
    globalconfig = config; // set new global config
    InstanceSelect(globalconfig.deviceinfo.protocol.name);
}

var ModbusDeviceConnector = function(config)
{
    console.log(globalconfig.deviceinfo.deviceid + ": Start ModBus connector"); 

    var type = globalconfig.deviceinfo.protocol.type; // Inverter bonfiglioli
    var host = globalconfig.deviceinfo.protocol.host;
    var port = globalconfig.deviceinfo.protocol.port;

    switch(type) 
        {
            case "ACU":
                ACUTaskClientCreate(host, port);
            break;

            default:
            break;
        }
}

ACUTaskClientCreate = function(host, port)
{

    for (let i = 0; i < globalconfig.parameters.length; i++)
    {   
        const spawn = require('threads').spawn;

        const thread = spawn(function(input, done) {
            done('Awesome thread script may run in browser and node.js!');
        });

        thread
        .send({ do: ModTask(i, host, port)})
        // The handlers come here: (none of them is mandatory)
        .on('error', function(error) {
            console.error('Worker errored:', error);
        })
        .on('exit', function() {
            console.log('Worker has been terminated.');
        });
    }
}

var ilk = 0;

ModTask = function(i, host, port)
{

    var options = {
      'host': host,
      'port': port,
      'unitId': 1,
      'logEnabled': false,
      'logLevel': 'debug',
    }
 
    var modbus = require('jsmodbus')
    var net = require('net')

    socket = new net.Socket()
    client = new modbus.client.TCP(socket)

    socket.on('connect', function () 
    { //handle

        var name = globalconfig.parameters[ilk].name;
        var interval = globalconfig.parameters[ilk].interval;
        var decimal = globalconfig.parameters[ilk].decimal;
        var unit = globalconfig.parameters[ilk].unit;
        var category = globalconfig.parameters[ilk].category;
    
        var parameter = globalconfig.parameters[ilk].additionalinfo.parameter;
        var bit = globalconfig.parameters[ilk].additionalinfo.bit;
        var dataset = globalconfig.parameters[ilk].additionalinfo.dataset;

        console.log("");
        console.log("Name: " + name);
        console.log("Param: " + parameter);

        var angRegistry = parseInt(intToBin(dataset) + "000000000000", 2) + parameter;
        console.log("Register: " + angRegistry);

        client.readHoldingRegisters(angRegistry, bit/16)
        .then(function (resp) 
        {

            let time = new Date().toISOString(); // formato UTC

            var value = angConversion(resp.response._body._valuesAsArray, decimal);

            //console.log(JSON.stringify(resp));
            //console.log(value);

            MODBUSCreateJSON(value, time, unit, category, name);

            socket.end()
        }).catch(function () 
        {
            console.error(require('util').inspect(arguments, {
            depth: null }))

            socket.end()
        });


        ilk = ilk + 1;
        if (ilk >=  globalconfig.parameters.length){
            ilk = 0;
        }
    })

    socket.on('error', console.error) //handle

    new Promise(function(resolve, reject) {
        setInterval(function() 
        {
            socket.connect(options)
        }, globalconfig.parameters[i].interval + 50 * i ); //put interval !!
        }).then(function(){
        console.log('done');
    });

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

    SOAPTaskClientCreate(request, wsdl, options, endpoint);
}

var SOAPTaskClientCreate = function(request ,wsdl, options, endpoint)
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
                SOAPCreateJSON(globalconfig.parameters[i], arrayIndex[j], pkt);
                console.log(globalconfig.deviceinfo.deviceid + ": PKT JSON Created !");
                NoEntry = 1;
            } 
        }
    }

    if (NoEntry == 0)
        console.log(globalconfig.deviceinfo.deviceid + ": No Match between JSON and SOAP PKT, check correct baseID parameters");
}


var MODBUSCreateJSON = function (Value, Time, Unit, Category, Name) 
{

    var TimeReq = Date.now();

    // formato dati ready to the cloud
    // THIS IS SO IMPORTANT - DATA MODEL !
    let data = {
        value: Value,
        name: Name,
        deviceid: globalconfig.deviceinfo.deviceid,
        groupdeviceid: globalconfig.deviceinfo.groupdeviceid,
        category: Category,
        unit: Unit,
        timestamp: Time,
        timerequest: TimeReq, // opz
    }
    
    SendJSONData(data);
}


var SOAPCreateJSON = function (ParamConfig, Index, Pkt) 
{

    var Value = Pkt.MeasurementJobStatus[Index.j].CharacteristicValueStatus[Index.i].CurrentValue;
    var OriginUnit = Pkt.MeasurementJobStatus[Index.j].CharacteristicValueStatus[Index.i].Unit;
    var Timestamp = Pkt.MeasurementJobStatus[Index.j].CharacteristicValueStatus[Index.i].LastMeasurementTime;
    var TimeReq = Date.now();

    Value = UnitConvert(ParamConfig.unit, OriginUnit, Value ); // controlla se l'unità di misura è uguale, altrimenti converte. può fare anche altri aggiustamenti vari
    Value = Approx(ParamConfig.decimal, Value );

    // formato dati ready to the cloud
    // THIS IS SO IMPORTANT - DATA MODEL !
    let data = {
        deviceid: globalconfig.deviceinfo.deviceid,
        groupdeviceid: globalconfig.deviceinfo.groupdeviceid,
        category: ParamConfig.category,
        name: ParamConfig.name,
        unit: ParamConfig.unit,
        timestamp: Timestamp,
        value: Value,
        timerequest: TimeReq, // opz
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
    
    fs.appendFileSync(config.info.path, content + "\n", 'utf8', function (err) {
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

        case "MODBUS":
            ModbusDeviceConnector(globalconfig);
            break;
    }

} 


// TOOLS

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

var intToBin = function(dec){
    return (dec >>> 0).toString(2);
}

var signConversion = function(value,bit) {
    var result = value;
    var maxSignedNum = Math.pow(2, bit-1)-1;
    if (value > maxSignedNum) result = value - Math.pow(2, bit);
    return result;
}

var angConversion = function(valuesAsArray,decimal) 
{
    var result = valuesAsArray[0];
    var bit = 16;
    var signed = false;

    if (decimal > 0)
        signed = true;

    if (valuesAsArray.length===2){
        result = (((valuesAsArray[0] & 0xffff) << 16) | (valuesAsArray[1] & 0xffff));  
        bit = 32;
    }
    if (signed){
        result = signConversion(result,bit);
    }
    
    result = decimalConversion(result,decimal);
    return result.toFixed(decimal);
}

var decimalConversion = function(value, decimal) {
	var	conversionFactor = 1;
	if (decimal > 0){
		conversionFactor = Math.pow(10, decimal);
	}
	return (value/conversionFactor);
}
var valueConversion = function(value, type) {
	var iValue = value;
	if (type==="boolean"){
		iValue = !!value;
	}
	return iValue;
}


module.exports = DeviceConnector;