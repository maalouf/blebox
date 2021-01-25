/*
var fs = require('fs');
var async = require('async');
var res = {};
const testFolder = '/usr/share/zoneinfo/America';
var fl = require("jsonfile");

function addAsMaster(path,fn,callback){
	console.log("filling " + fn)
	fs.readdir(path, function(err, files){
		a = [];
		async.forEach(files,function(file,next1){
			a.push(file);
			next1();
		},function(err){
			res[fn] = a;	
			callback();
		});

	});
}



fs.readdir(testFolder, function(err, files){
	async.forEach(files,function(file,next){
		fullfile = testFolder + "/" + file;
		if ( fs.statSync(fullfile).isDirectory()){
			console.log("going for " + file);
			addAsMaster(fullfile,file,next);
		} else {
			next();
		}
	}, function(err){
		fl.writeFile('./configurator/zoneAm.json',res,{spaces: 4},function(err){});
	});
});



*/

var wifi_manager = require('./wifiApp/wifi_manager')();
require("./app/api.js")(wifi_manager,function(err){},function(er){});




