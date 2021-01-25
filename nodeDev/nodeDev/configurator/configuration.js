var fs      = require("jsonfile");
var ipCalc =  require('./ipCalculator');
var fse = require('fs');

var _saveAdminLog = function(data){
	file = './app/public/external/intPass.json';
	fs.writeFileSync(file,data,{spaces:4});
}

var _saveAPData = function(data,callback){
		file = './wifiApp/config.json';
		dataOld = fs.readFileSync(file);
		dataOld.access_point.ssid = data.ssid;
		dataOld.access_point.passphrase = data.pass;
		 
		if ((data.ip !== dataOld.access_point.ip_addr ) || (data.net !== dataOld.access_point.netmask)){
			ip4 = new ipCalc.Ip4_netAdress(data.ip,data.net) ;
			dataOld.access_point.ip_addr = data.ip;
			dataOld.access_point.netmask = data.net;
			dataOld.access_point.subnet_ip = ip4.netaddressDotQuad;
			dataOld.access_point.broadcast_address = ip4.netbcastDotQuad;
			if (ip4.lowerRange.num > ip4.highRange.num ){
				dataOld.access_point.subnet_range.start = ip4.lowerRange.minDotQuad;
				dataOld.access_point.subnet_range.end = ip4.lowerRange.maxDotQuad;
			} else {
				dataOld.access_point.subnet_range.start = ip4.highRange.minDotQuad;
				dataOld.access_point.subnet_range.end = ip4.highRange.maxDotQuad;
			}
		}
		dataOld.server.port = data.port;
		fs.writeFile('./wifiApp/config.json',dataOld,{spaces: 4},callback);
}

var copyFile = function(source, target,call){
	  var rd = fse.createReadStream(source);
	  rd.on("error", function(err) {
	    call(err);
	  });
	  var wr = fse.createWriteStream(target);
	  wr.on("error", function(err) {
	    call(err);
	  });
	  wr.on("close", function(ex) {
	    call(false);
	  });
	  rd.pipe(wr);
}



var updateTimeZone = function(data){
	ajStr =  data.continant + "/" + data.city;
	var timing = require('../database/timeRegulator');
	path = "/usr/share/zoneinfo/" + ajStr;
	dest = "/etc/localtime";
	aj = "/etc/timezone";

		
	console.log(path + " -> " + dest);
	copyFile(path,dest,function(err){
		if(!err){
			fse.writeFile(aj,ajStr,function(err){
				timing.immediateUpdate();
			});
		}
	});
	
}

var _saveProgramSettings = function(dataIn,callback){
	data = dataIn.scan;
	file = './ble/ble_config.json';
	sweepSec = (parseInt(data.sweep.hour) * 3600) +  (parseInt(data.sweep.min) * 60) + parseInt(data.sweep.sec);
	perSec = (parseInt(data.period.hour) * 3600) +  (parseInt(data.period.min) * 60) + parseInt(data.period.sec);
	obsSec = (parseInt(data.device.hour) * 3600) +  (parseInt(data.device.min) * 60) + parseInt(data.device.sec);
	
	console.log("****************************************");
	
	newData = {
			"scanningTime" : (sweepSec * 1000),
			"scanningPeriode" :	(perSec * 1000),
			"obsoletTimeOut"  : (obsSec * 1000),
			"timeSpan"	:	dataIn.quiet,
			"timeZone"	:	{
			    	"continant"	:	dataIn.zone.continant ,
			    	"place"	:	dataIn.zone.city
			 }
	};
	fs.readFile(file,function(err,ob){
		console.log(err + ", " + ob);
		if ((newData.timeZone.continant != ob.timeZone.continant) ||(newData.timeZone.place != ob.timeZone.place)){
			console.log("updating timezone");
			updateTimeZone(dataIn.zone);	
		}
		console.log(newData);
		fs.writeFile(file,newData,{spaces: 4},callback);
	})
}



var _readAppSettings = function() {
	return fs.readFileSync('./ble/ble_config.json');
}


var _readZoneList = function() {
	return fs.readFileSync('./configurator/zone.json');
}

var _readAPConf = function(){
	return fs.readFileSync('./wifiApp/config.json');
}

var _readSettingsBackup = function(){
	return fs.readFileSync('./wifiApp/settingHistory.json');
}

var _writeSettingsBackup = function(config){
	fs.writeFile('./wifiApp/settingHistory.json',config,{spaces: 4},function(err){});
}

module.exports = {
		saveAdminData : _saveAdminLog,
		saveAPData : _saveAPData,
		saveProgramSettings : _saveProgramSettings,
		readAP :  _readAPConf,
		readSet : _readAppSettings,
		readZoneList : _readZoneList,
		write_settings_backup : _writeSettingsBackup,
		read_settings_backup : _readSettingsBackup
};