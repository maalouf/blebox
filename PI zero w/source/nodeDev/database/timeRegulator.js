const isReachable = require('is-reachable');
var Sntp = require('sntp');
var exec    = require("child_process").exec;

var options = {
 host: 'fr.pool.ntp.org',  // Defaults to pool.ntp.org
 port: 123,                      // Defaults to 123 (NTP)
 resolveReference: true,         // Default to false (not resolving)
 timeout: 10000                   // Defaults to zero (no timeout)
};

var timing = null;
var offset = 999;
var trial = 8;

function updateTime(){
	isReachable('www.google.com').then(function(res){
		if(res){
			console.log("correcting time");
		    updateTimeNow(function(err){});
		} else { // no internet connection
			console.log("no net connection for sntp")
		}
	});
}

function updateTimeInit(callback){
	isReachable('www.google.com').then(function(res){
		if(res){
			console.log("correcting time");
		    updateTimeNow(callback);
		} else { // no internet connection
			console.log("no net connection for sntp")
			callback(false);
		}
	});    			
}

function updateTimeNow(callback){
	   console.log("connecting time.nist.gov...");
	   exec("sudo ntpdate -b time.nist.gov", function(error, stdout, stderr) {
	       if (!error) console.log("time Update successful...");
	       callback(error);
	   });
}

var startService = function(timeUpdate,unit,callback){
	if (timing != null){
		clearInterval(timing);
	}
	var upd = 0;
	switch (unit) {
	case "m":{
		upd = timeUpdate * 60000;
		break;
	}
	case "h":{
		upd = timeUpdate * 3600000;
		break;
	}
	default: {
		upd = timeUpdate * 1000;
	}
	}
	timing  = setInterval(updateTime,upd);
	console.log("init update start");
	updateTimeInit(callback);

}

var stopService = function(){
	if (timing != null){
		clearInterval(timing);
		timing = null;
	}
}

module.exports = {
		start_clock_service : startService,
		stop_clock_service : stopService,
		immediateUpdate : updateTimeNow
}
