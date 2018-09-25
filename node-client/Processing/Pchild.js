var _subModule; //global

process.on('message', (msg) => {

    const SubModule = require("./subModule/" + msg.taskInfo.subModuleRef);
    _subModule = new SubModule(msg);

});