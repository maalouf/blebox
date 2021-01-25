
var reg = require('./database/timeRegulator');
var events = require('events');
var wifi_manager = require('./wifiApp/wifi_manager')();
var async               = require("async");
var exec    = require("child_process").exec;
var gpio = require('./gpio/gpio');
var fireBase = require('./database/firebase');
var fs = require("jsonfile");
var isEmitting = false;
var bleModule = require('./ble/nodeBle2');
var scanningTimer = null;
var errorMode = false;

function ap_creationError(){
	errorMode = true;
	gpio.signal_AP();
	gpio.signal_emitting();
}


function getEth0Status(callback){
	exec("cat /sys/class/net/eth0/operstate", function(error, stdout, stderr){
		callback(stdout.replace("\n",""));
	 });
}

function startBleCollection(){
	var bleConfig = fs.readFileSync('./ble/ble_config.json');
	if (scanningTimer != null){
		 clearInterval(scanningTimer);
	}
	gpio.signal_scanning(true);
	bleModule.startDataDetection(bleConfig.scanningTime,bleConfig.obsoletTimeOut,bleConfig.timeSpan);
	scanningTimer = setInterval(function(){
		gpio.signal_scanning(true);
		bleModule.startDataDetection(bleConfig.scanningTime,bleConfig.obsoletTimeOut,bleConfig.timeSpan); //scanning time , device timeout
	},bleConfig.scanningPeriode);
	//TODO make it in sec / minuts
}

function callbackwifi(flag){
	switch (flag) {
		case "wifiEnabled" : {
			gpio.signal_net_ok();
			//reg.immediateUpdate(function(err){console.log("time reupdate");
			startBleCollection();
			//});
	
			break;
		}
		case "lanEnabled" : {
			gpio.signal_net_ok();
			//reg.immediateUpdate(function(err){console.log("time reupdate");
			startBleCollection();
			//});
	
			break;
		}
		case "APConfOK" :{
			//restart APHOST
			break;
		}
		case "APConfKO" : {
			Console.log("Error AP");
			break;
		}
		case "SettingsOK" :{
			wifi_manager.is_wifi_enabled(function(err,enb){
				if (enb){
					startBleCollection();
				}
			});
			break;
		}
		case "SettingsKO" : {
			Console.log("Error Settings");
			break;
		}
		default : {
			
		}
	}
}

function handleWifiCase(callback){
	async.series([
         //Check if wifi is enabled / connected
         function test_is_wifi_enabled(next_step) {
	        wifi_manager.is_wifi_enabled(function(error, result) {
	            if (result) {
	                console.log("\nWifi is enabled, and IP " + result + " assigned");
	                require("./app/api.js")(wifi_manager, next_step,callbackwifi); // disable if no LAN config
	                callback();
	                next_step(true);
	            } else {
	                console.log("\nWifi is not enabled, Enabling AP for self-configure");
	                next_step(error);
	            }
	        });
	    },

	    // 3. Turn RPI into an access point
	    function enable_rpi_ap(next_step) {
	        wifi_manager.enable_ap_mode(function(error) {
	            if(error) {
	            	ap_creationError();
	                console.log("... AP Enable ERROR: " + error);
	            } else {
	                console.log("... AP Enable Success!");
	        		gpio.signal_AP();
	            }
	            next_step(error);
	        });
	    },

	    // 4. Host HTTP server while functioning as AP, the "api.js"
	    //    file contains all the needed logic to get a basic express
	    //    server up. It uses a small angular application which allows
	    //    us to choose the wifi of our choosing.
	    function start_http_server(next_step) {
		console.log("enablig server");
	        require("./app/api.js")(wifi_manager, next_step,callbackwifi);
	    },
		], function(error) {
		    if (error) {
		        console.log("stop: " + error);
		    }
		    
	});

}


/************************************************************************************/
// data from bluetooth is ready


bleModule.eventEmitter.on("dataBlockReady",function(dataArray){
	gpio.signal_emitting();
	isEmitting = true;
	console.log("--->" + dataArray.length);
	async.forEach(dataArray,function(data,nextItem){
		fireBase.sendData(data.deviceName,data.data,nextItem);
	},function(err){
		isEmitting = false;
		gpio.signal_scanning(false);
		console.log("################## DATA SENT #################");
	});
});




/*************************************************************************/

function forceAPCreation(){
	if (isEmitting || bleModule.isScanning()){
		setTimeout(forceAPCreation,50);
		return;
	} else {
		async.series([
		              function stopScanningTimer(next_step){
		            	  if (scanningTimer != null){
		            		  clearInterval(scanningTimer);
		            		  scanningTimer = null;
		            		  next_step(false);
		            	  } else {
		            		  next_step(false);
		            	  }
		              },
		              function enable_rpi_ap(next_step) {
					        wifi_manager.enable_ap_mode(function(error) {
					            if(error) {
					                console.log("... AP Enable ERROR: " + error);
					             	ap_creationError();
					            } else {
					                console.log("... AP Enable Success!");
					            }
					            next_step(error);
					        });
					    },
					    function start_http_server(next_step) {
					        require("./app/api.js")(wifi_manager, next_step,callbackwifi);
					    },
						], function(error) {
							gpio.signal_AP();
						    if (error) {
						        console.log("ERROR: " + error);
						    }
						});
	}
}

gpio.events.on('buttonClick',function(){
	if (errorMode){
		errorMode = false;
		exec("reboot", function (error, stdout, stderr) {
			console.log("Reboot...");
		});
	} else {
		forceAPCreation();
	}
});

getEth0Status(function(data){
	reg.start_clock_service(4,"h",function(error){
		if (data == "up"){
			console.log("eth0 ok");
			gpio.signal_net_ok();
			require("./app/api.js")(wifi_manager,function(err){
				setTimeout(startBleCollection,1000);
			},callbackwifi);
			
		} else {
			console.log("th0 no ok");
			handleWifiCase(function(){
				console.log("stuff ok");
				reg.immediateUpdate(function(err){console.log("time reupdate");});
				gpio.signal_net_ok();
				startBleCollection();
			});
		}
	});
});

