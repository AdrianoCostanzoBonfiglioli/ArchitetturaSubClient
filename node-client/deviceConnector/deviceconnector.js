var globalconfig;

var DeviceConnector = function (config) 
{
    globalconfig = config; // set new global config
    InstanceSelect(globalconfig.deviceinfo.protocol.name);
}

var ModbusDeviceConnector = function(config)
{
    console.log(config.deviceinfo.deviceid + ": Start ModBus connector"); 

    var type = config.deviceinfo.protocol.type; 
    var host = config.deviceinfo.protocol.host;
    var port = config.deviceinfo.protocol.port;

    var options = {
      'host': host,
      'port': port,
      'unitId': 1,
      'logEnabled': false,
      'logLevel': 'debug',
    }

    var modbus = require('jsmodbus')
    var net = require('net')
    var socket = new net.Socket()
    var client = new modbus.client.TCP(socket)

    // manage the connection
    socket.on('connect', function () 
    { 
        //depending on the device type, I will instantiate a different task 
        switch(type) 
        {
            case "ACU": // Inverter bonfiglioli
                ACUTaskClientCreate(config,client); 
            break;

            default:
            break;
        }
       
    });

    socket.on('error', console.error) //handle
    socket.connect(options)
    
    //override exit handler
    process.stdin.resume();//so the program will not close instantly
    function exitHandler(options, exitCode) {
        socket.end();
        if (options.cleanup) console.log('clean');
        if (exitCode || exitCode === 0) console.log(exitCode);
        if (options.exit) process.exit();
    }

    //do something when app is closing
    process.on('exit', exitHandler.bind(null,{cleanup:true}));
    //catches ctrl+c event
    process.on('SIGINT', exitHandler.bind(null, {exit:true}));
    // catches "kill pid" (for example: nodemon restart)
    process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
    process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
    //catches uncaught exceptions
    process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
}

ACUTaskClientCreate = function(config,client)
{
    //legge il parametro via modbus seguendo le informazioni in input
    var modbusCall = function(parameterInfo){
        return new Promise(function(resolve, reject){
            
            var decimal = parameterInfo.decimal;
            var parameter = parameterInfo.additionalinfo.parameter;
            var bit = parameterInfo.additionalinfo.bit;
            var dataset = parameterInfo.additionalinfo.dataset;

            var angRegistry = parseInt(intToBin(dataset) + "000000000000", 2) + parameter;
            //console.log("Register: " + angRegistry);

            client.readHoldingRegisters(angRegistry, bit/16)
            .then(function (resp) 
            {
                //console.log(JSON.stringify(resp));
                var convertedResult = angConversion(resp.response._body._valuesAsArray, decimal);
                resolve(convertedResult); // link to modbusCall(parameterInfo).then -> function(result){ // lo ritrovi dentro result
            }).catch(function () 
            {
                reject(require('util').inspect(arguments, { depth: null }))
                // link to modbusCall(parameterInfo).then -> function(err){{ // lo ritrovi dentro err
            });
            
        });
    };

    //scorre tutti i parametri e per ogni parametro richiama la modbusCall ripetutamente in base al relativo intervallo
    config.parameters.forEach(function(parameterInfo) {
        var loopId = setInterval( function() {
            modbusCall(parameterInfo).then(
                //resolved
                function(result){

                    var value = result;
                    var name = parameterInfo.name;
                    var unit = parameterInfo.unit;
                    var category = parameterInfo.category;
                    let time = new Date().toISOString(); // formato 

                    MODBUSCreateJSON(value, time, unit, category, name);
                    console.log("Loop ACUTaskClientCreate: for parameter <"+ parameterInfo.additionalinfo.parameter +"> this is the resolved value <"+result+parameterInfo.unit+">");
                },
                //rejected
                function(err){
                    console.log("ERROR ACUTaskClientCreate for parameter <"+ parameterInfo.additionalinfo.parameter +"> this is the error <"+err+">");
                    //exit from setInterval
                    clearInterval(loopId); // kill to SetInterval
                }
            )}, parameterInfo.interval // intervallo della SetInterval
        ); 
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