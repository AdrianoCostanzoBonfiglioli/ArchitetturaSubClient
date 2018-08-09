var _cloudconnector;

const CloudConnector = require('./cloudConnector/cloudconnector');
var _cloudconfig = require('./cloudConnector/configurations/CloudConnector.json');


if (_cloudconfig.cloudside[0].name != "") {

    console.log("Start CloudConnector...");

    _cloudconnector = new CloudConnector(_cloudconfig);

} else {
    console.log("No Clouds Available");
}