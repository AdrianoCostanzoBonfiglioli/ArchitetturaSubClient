const FolderTocheck = './deviceConnector/configurations/';


var StartChild = function(data)
{
    const { fork } = require('child_process');

    const forked = fork('./deviceConnector/child.js');

    forked.send(data);

    forked.on('message', (msg) => {
    console.log(msg);
    });
}

var CheckConfig = function(namefile)
{
    var _DeviceConfig = require('./deviceConnector/configurations/' + namefile);

    if (_DeviceConfig.deviceinfo.deviceID != "") {

        console.log("Start Device Connector from: " + namefile);
        StartChild(_DeviceConfig);

    } else {
        console.log("JSON conf corrupted");
    }
}

// start
const fs = require('fs');

fs.readdirSync(FolderTocheck).forEach(file => {
  CheckConfig(file);
})

