var fs = require("jsonfile");
var bleModule = require('./ble/nodeBle2');
var async               = require("async");
var fireBase = require('./database/firebase');
var timeSpan =  {
    "active": false,
    "start": {
        "hour": "1",
        "min": "1"
    },
    "stop": {
        "hour": "1",
        "min": "1"
    }
};



scanningTimer = setInterval(function(){
	bleModule.startDataDetection(3000,180000,timeSpan);
},10000);

bleModule.startDataDetection(3000,15000,timeSpan);



bleModule.eventEmitter.on("dataBlockReady",function(dataArray){
	
	console.log(dataArray.length);
	async.forEach(dataArray,function(data,nextItem){
		fireBase.sendData(data.deviceName,data.data,nextItem);
	},function(err){
		console.log("################## DATA SENT #################");
	});
});
