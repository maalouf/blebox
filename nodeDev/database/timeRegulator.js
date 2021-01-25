const isReachable = require('is-reachable');
var Sntp = require('sntp');
var exec    = require("child_process").exec;
var options = {
 host: 'time.nist.gov',  // Defaults to pool.ntp.org
 port: 123,                      // Defaults to 123 (NTP)
 resolveReference: true,         // Default to false (not resolving)
 timeout: 10000                   // Defaults to zero (no timeout)
};

var timing = null;
var offset = 999;

function updateTime(){
	isReachable('www.google.com').then(reachable => {
	    Sntp.time(options, function (err, time) {
	    //	if (Math.abs(time.t) > offset){
	    		console.log("correcting time");
	    		exec("sudo ntpdate -s time.nist.gov", function(error, stdout, stderr) {
	               if (!error) console.log("time Update successful...");
	            });
	    //	}
	    //	console.log('Local clock is off by: ' + time.t + ' milliseconds');
	    });
	});
}

function updateTimeNow(){
	isReachable('www.google.com').then(reachable => {
	   exec("sudo ntpdate -s time.nist.gov", function(error, stdout, stderr) {
	       if (!error) console.log("time Update successful...");
	   });
	});
}

var startService = function(timeUpdateSec,prec){
	offset = typeof prec  !== 'undefined' ?  prec  : 999;
	console.log(offset);
	if (timing != null){
		clearInterval(timing);
	}
	updateTime();
	timing  = setInterval(updateTime,timeUpdateSec*1000);
	
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
