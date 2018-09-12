var _pp;

var _ppconfig = require('./PreProcessing/configurations/ppModule.json');
const PPmodule = require('./PreProcessing/ppmodule');

console.log("Start Pre-Processing Module...");

for (let j = 0; j < _ppconfig.submodule.length; j++)
{

    switch(_ppconfig.submodule[j].name) 
    {
        case "PushRAWdata":
        {
            console.log("Start PushRAWdata Sub-Module...");

            
            _pp = new PPmodule.PushRAWData(_ppconfig);

            break;
        }

        case "PullRAWdata":
        {
            console.log("Start PullRAWdata Sub-Module...");
            _pp = new PPmodule.PullRAWData(_ppconfig);
            
            break;
        }

        default:
        {
            console.log("No Sub-Module Availables");
            break;
        }
    }
    
}

