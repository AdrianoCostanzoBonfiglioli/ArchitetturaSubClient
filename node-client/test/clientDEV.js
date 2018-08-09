var soap = require('soap');
var url = 'http://10.1.154.14:10080/wsdl/smartcheck_status_201601.wsdl';

var request = { 'smc:UserId': 'admin', 'smc:Password': 'admin123' };
var options = { envelopeKey: 'soapenv', forceSoap12Headers: true };

var createClient = function(endpoint){
    return new Promise(function(resolve, reject){
        soap.createClient(url, options, function (err, client) {
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

createClient('http://10.1.154.14:10080/smcstatus').then(
    // manage the resolve
    function(client){
        setInterval( function() {
            apiCall(client).then(
                //resolved
                function(result){
                    console.log(result);
                },
                //rejected
                function(err){
                    //return 1; 
                }
            )}, 10000 // every 1 sec
        ); 
    },
    //manage the reject
    function(err){
        //return 1; 
    }
);