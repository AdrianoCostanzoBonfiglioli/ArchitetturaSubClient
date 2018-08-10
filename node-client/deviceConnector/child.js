
var _deviceConnector; //global

const DeviceConnector = require('./deviceconnector');

process.on('message', (msg) => {

    _deviceConnector = new DeviceConnector(msg);

    //DBG
    //console.log("I'm child, this is my myfileconf: ");
    //console.log(msg);

  });
