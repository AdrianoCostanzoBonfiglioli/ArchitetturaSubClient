const FolderTocheck = './Processing/subModule/configurations';

var StartChild = function(jsonconfig)
{
    const { fork } = require('child_process');

    const forked = fork('./Processing/Pchild.js');

    forked.send(jsonconfig);

    forked.on('message', (msg) => {
    console.log(msg);
    });
}

var CheckConfig = function(namefile)
{
    var _SubModuleConfig = require('./Processing/subModule/configurations/' + namefile);

    switch(_SubModuleConfig.subModuleRef)
    {
        case "rul.js":
            console.log("Start Processing Submodule From: " + "rul.js");
            StartChild(_SubModuleConfig);
        break;

        default:
            console.log("JSON conf corrupted or not exists");
        break;
    }
}

const fs = require('fs');

fs.readdirSync(FolderTocheck).forEach(file => {
    CheckConfig(file);
})