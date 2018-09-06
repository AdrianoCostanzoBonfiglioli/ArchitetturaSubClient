var path = require('path');
var scriptName = path.basename(__filename);

var mode = "ang";
var host = "192.168.10.15";
var port = "502";
var registry;
var parameter;
var dataset;
var debug = false;
var bit = 16;
var signed = true;
var decimal = 1;

var intToBin = function(dec){
    return (dec >>> 0).toString(2);
}

var signConversion = function(value,bit) {
    var result = value;
    var maxSignedNum = Math.pow(2, bit-1)-1;
    if (value > maxSignedNum) result = value - Math.pow(2, bit);
    return result;
}

var angConversion = function(valuesAsArray,decimal,signed=true) {
    var result = valuesAsArray[0];
    var bit = 16;
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

var printUsage = function(){
	console.log("\nUsage: node "+scriptName+" [--mode ang --host <Modbus Hostname or IP> --port <Modbus Port>] --parameter <number> --dataset <number> --type uint|int|long --decimal <natural number>\n");
	console.log("Where: host default is \"192.168.10.15\", port default is \"502\"\n");
	process.exit(-1);
};

var argv = require('minimist')(process.argv.slice(2));

if (argv.mode !== "ang"){
	printUsage();
}
if (typeof argv.host !== "undefined"){
	host = argv.host;
}
if (typeof argv.port !== "undefined"){
	port = argv.port;
}
if (mode==="ang"){
	if (typeof argv.parameter !== "undefined" && (typeof argv.dataset !== "undefined")){
		parameter = argv.parameter;
		dataset = argv.dataset;
	}else{
        console.log("1");
		printUsage();
	}
    
	if (typeof argv.type !== "undefined"){
        if (argv.type === "uint"){
            bit = 16;
            signed = false;
        }else if (argv.type === "int"){
            bit = 16;
            signed = true;
        }else if (argv.type === "long"){
            bit = 32;
            signed = true;
        }else{
            console.log("2");
            printUsage();
        }
	}else{
        console.log("3");
		printUsage();
	}
    
    if (typeof argv.decimal !== "undefined"){
		decimal = argv.decimal;
	}else{
        console.log("4");
		printUsage();
	}
}
if (typeof argv.debug !== "undefined"){
	debug = argv.debug;
}

var modbus = require('jsmodbus')
var net = require('net')
var socket = new net.Socket()
var options = {
  'host': host,
  'port': port,
  'unitId': 1,
  'logEnabled': debug,
  'logLevel': 'debug'
}
var client = new modbus.client.TCP(socket)

socket.on('connect', function () {
	console.log("");
    if (mode==="ang") {
		//read from Inverter the exported registry
		var angRegistry = parseInt(intToBin(dataset) + "000000000000",2)+parameter;
		client.readHoldingRegisters(angRegistry, bit/16)
		.then(function (resp) {
			console.log(JSON.stringify(resp));
            console.log(angConversion(resp.response._body._valuesAsArray,decimal,signed));
          socket.end();
        }).catch(function () {
          console.error(require('util').inspect(arguments, {
            depth: null
          }))
          socket.end()
        });
	}
})

socket.on('error', console.error)
socket.connect(options)