'use strict';

var noble = require('noble');
var events = require('events');
var fs = require("jsonfile");

var eventEmitter = new events.EventEmitter();
var mldpServiceUUID = '00035b0358e607dd021a08123a000300';
var mldpCharUUID = '00035b0358e607dd021a08123a000301';
var replyEndLine = "#";

var mldpCharCharacteristic = null;
var mldpControlCharacteristic = null;
var mldpService = null;
var currentDevice = null;


var tempoReplyData = "";
var isBlutoothOn = false;

var isScanning  = false;













/***************************************** Data block *************************************/

function isBleScanning(){
	return isScanning;
}

function iterableArray(deviceArray){
	this.arrayDevices = deviceArray;
	this.index = -1;
	this.hasNext = function(){
		return ((this.index + 1) < this.arrayDevices.length);
	};
	this.hasPrevious = function(){
		return ((this.index - 1) < 0);
	};
	this.getNext = function(){
		this.index++;
		return this.arrayDevices[this.index];
	};
	
	this.getCurrentElement = function(){
		if (this.index >= 0){
			return this.arrayDevices[this.index];
		} else {
			return this.arrayDevices[0];
		}
	};
	
	this.getPrevious = function(){
		this.index--;
		return arrayDevices[this.index];
	};
	
	this.resetIndex = function() { this.index = -1;};
	
	this.setIndex = function(ind){this.index = ind;};
	
	this.push = function(data) {
		this.arrayDevices.push(data);
	};
	
	this.deleteElement = function(ind){
		if ((ind >= 0) && (ind < this.arrayDevices.length)){
			this.arrayDevices.splice(ind,1);
		}
	};
	
	this.getCurrentIndex = function(){
		return this.index;
	};
	
	this.empty = function(){
		this.arrayDevices.length = 0;
		this.index = -1;
	};
}


var commandDataSet = fs.readFileSync("./ble/commands.json");

/************ create command sets *************/

var commandID = [];
for (var attr in commandDataSet){
	commandID.push(attr);
}
var commandSet = new iterableArray(commandID);

/************ create command sets *************/




var devicesToProcess = new iterableArray([]); // devices to be used each time
var detectedDevices = []; // scan result
var oldDevices = []; // already processed devices
var fullDataSet = []; // a full scan result of dataBlocks


var timeScan = 5000;
var deviceObsoletTime = 0;
var currentDataBlock;


function deviceBlock(device) {
	this.device = device;
	this.detected = Date.now();
	
	this.searchForIt = function(arrayDeviceBlock){
		for (var i = 0, len = arrayDeviceBlock.length; i < len; i++){
			if (arrayDeviceBlock[i].device.id == this.device.id){
				return i;
			}
		}
		return -1;
	}
	
	this.getTimeDifference = function(otherDevice){
		return (otherDevice.detected - this.detected);
	}
}


function filterDevices(devicesBuffer,deviceTimeOut,callBack){ //callback take devices results
	//receive devices - filter them , empty return data and update iterable devices to use
	fullDataSet.length = 0;
	devicesToProcess.empty();
	for (var i in devicesBuffer){
		var device = new deviceBlock(devicesBuffer[i]);
		var indexTempo = device.searchForIt(oldDevices);
		if (indexTempo >= 0){ // already been detected
			console.log(oldDevices[indexTempo].getTimeDifference(device) );
			if (oldDevices[indexTempo].getTimeDifference(device) > deviceTimeOut){ // have been a while so it is ok
				oldDevices[indexTempo].detected = device.detected; // update use
				devicesToProcess.push(device);
			}
		} else {
			oldDevices.push(device);
			devicesToProcess.push(device);
		}
	}
	
	//PS old not used data is always here
	callBack();
}


function cleanupOldDevices(timeOut){
	var remIndex = [];
	var time = Date.now();
	for (var i in oldDevices){
		if ((time - oldDevices.detected) > timeOut){
			remIndex.push(i);
		}
	}
	
	for (var i = remIndex.length -1; i >= 0; i--)
		   oldDevices.splice(remIndex[i],1);
}

/***************************************** acquier single device data ***************************/


//Data received via serial and procesed into single reply line for a single command
function charCallback(data, isNotification){ // receive data and create one line reply per command
	tempoReplyData = tempoReplyData + data.toString('utf8');
	if (tempoReplyData.endsWith(replyEndLine)){
		var stringreply = tempoReplyData.slice(0,-1);
		tempoReplyData = "";
		eventEmitter.emit('replyData',stringreply); // an entire result is ready ... process in on replyData
	}
}


// process input to construct the data object ....
function constructDataFromLine(data,callback){
	var tempoID = commandSet.getCurrentElement();
	var fields = commandDataSet[tempoID].attrib_name;
	var inputs = data.split(";");
	if (fields.length >= inputs.length){
		for (var j = 0; j < inputs.length; j++){
			currentDataBlock.data[fields[j]]  = inputs[j].trim();
		}
	} else { // data should be concatented in last field
		for (var j = 0; j < fields.length - 1; j++){
			currentDataBlock.data[fields[j]]  = inputs[j].trim();
		}
		var concat = "";
		while(j < inputs.length){
			concat = concat + inputs[j].trim();
			j++;
		}
		currentDataBlock.data[fields[fields.length-1]] = concat;
	}
	callback();
}

//send command in line
function sendACommand(){
	var tempoCommandID = commandSet.getNext(); // get command id ...
	var sendCommand = new Buffer(commandDataSet[tempoCommandID].command,"hex"); //create command hex buffer
	mldpCharCharacteristic.write(sendCommand,true); // send command ... data will be received in charCallback
}


//data line received ............
eventEmitter.on('replyData',function(dataString){ // one line command is ready
	
	constructDataFromLine(dataString,function(){
		if (commandSet.hasNext()){
			sendACommand(); // next command
		} else {
			// terminate this device and go next
			fullDataSet.push(currentDataBlock);
			currentDevice.disconnect();
			console.log("Disconnect ... processing next");
			currentDevice = null;
			processDevice();
		}
	});
});


function controlCallback(){ // initiate data acquisition for one device
	fullDataSet.length = 0; // empty prevData;
	commandSet.resetIndex(); // start with first
	sendACommand(); // call send
}


/***************************************** NOBLE Callback **************************************/


function caracteristicCallback(characteristics){
	if (characteristics.length > 0){
		mldpCharCharacteristic = characteristics[0];
		mldpCharCharacteristic.subscribe(function(error){});
		mldpCharCharacteristic.on('data',charCallback);
		mldpCharCharacteristic.discoverDescriptors(function(error, descriptors){
			descriptors[0].writeValue(new Buffer([0x01,0x00]), function(error){});
			controlCallback();
		});
	}
}

function discoverCallback(services){
	mldpService = services[0];
	mldpService.once('characteristicsDiscover',caracteristicCallback);
	mldpService.discoverCharacteristics([mldpCharUUID]);
}

function onConnectCallback(){
	if (currentDevice !== null){
		console.log('connected... ');
		currentDevice.once('servicesDiscover',discoverCallback);
		currentDevice.discoverServices([mldpServiceUUID]);	//call discovers
	}
}

//launch devices array processing ........
function processDevice(){
	if(devicesToProcess.hasNext()){ //each device
		currentDevice = devicesToProcess.getNext().device;
		currentDataBlock = {};
		currentDataBlock.data = {};
		tempoReplyData = "";
		currentDataBlock.deviceName = currentDevice.advertisement.localName ; // not used any more
		currentDevice.once('connect',onConnectCallback);
		currentDevice.connect(); // call on connect
	} else {
		isScanning = false;
		eventEmitter.emit("dataBlockReady",fullDataSet); // terminate with a bang
	}
}

function stopScanAndProcess(deviceTime){ // processing devices
	noble.stopScanning();
	console.log("detection stopped");
	filterDevices(detectedDevices,deviceTime,processDevice); // update iterable devices 
}

noble.on('discover', function(peripheral) {
	console.log(peripheral.advertisement.localName);
	detectedDevices.push(peripheral);
});

function isInTimeSpan(timeSpan){
	var date = new Date();
	console.log(date);
	if (timeSpan.active == true){
		var div = 1.0 / 60;
		var hour = date.getHours() + (date.getMinutes() * div);
		var strt = parseInt(timeSpan.start.hour,10) + (parseInt(timeSpan.start.min,10) * div);
		var endt = parseInt(timeSpan.stop.hour,10) + (parseInt(timeSpan.stop.min,10) * div);
		if (strt < endt){
			 return ((hour >= strt) && (hour <= endt));
		} else {
			 return ((hour >= strt) || (hour <= endt));
		}
	} else {
		return false;
	}
}




noble.on('stateChange',function(state) {
	console.log("state:: " + state);
	if (state === 'poweredOn') {
		isBlutoothOn = true;
	} else {
		noble.stopScanning();
		isBlutoothOn = false;
	}
});


function startDetection(scanningTime, deviceTimeout,timeSpan){
	console.log("detection request... ");
	console.log(timeSpan);
	if (!isBlutoothOn){ //bluetooth is not on yet !
		console.log("ble not on yet ... ")
		setTimeout(function(){startDetection(scanningTime,deviceTimeout,timeSpan);},1000);
	} else {
		console.log("detection request...2222 ");
		
		if ((!isInTimeSpan(timeSpan)) && (isScanning == false)){
			console.log("detection started");
			isScanning = true;
			timeScan = scanningTime;
			deviceObsoletTime = deviceTimeout;
			detectedDevices.length = 0;
			console.log("Scanning");
			noble.startScanning(mldpServiceUUID);
			setTimeout(stopScanAndProcess,timeScan,deviceObsoletTime);
		} else {
			console.log("blocked by time");
			eventEmitter.emit("dataBlockReady",[]);
		}
	}
}







/***************************************** export **************************/

module.exports = {
		isScanning : isBleScanning,
		eventEmitter : eventEmitter,
		startDataDetection : startDetection, 
		cleanUpDeviceMemory : cleanupOldDevices
};








