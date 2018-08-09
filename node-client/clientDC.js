var _deviceConnector; //global

const DeviceConnector = require('./deviceConnector/deviceconnector');
var _DeviceConfig = require('./deviceConnector/configurations/FAGSmartCheck.json');


if (_DeviceConfig.deviceinfo.deviceID != "") {

    console.log("Start");

    _deviceConnector = new DeviceConnector(_DeviceConfig);

} else {
    console.log("No Devices Available");
}


