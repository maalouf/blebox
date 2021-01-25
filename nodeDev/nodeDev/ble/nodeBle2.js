var noble = require('noble');
var events = require('events');

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


var commandSet = new iterableArray([new Buffer([0xaa,0x2c,0xcc]),new Buffer([0xaa,0x30,0xcc]),new Buffer([0xaa,0x35,0xcc]),new Buffer([0xaa,0x36,0xcc])]);
var commandID = ["serial","userblock","bladeClutch","mowedSurface"];

var devicesToProcess = new iterableArray([]); // devices to be used each time
var detectedDevices = []; // scan result
var oldDevices = []; // already processed devices

var fullDataSet = []; // a full scan result of dataBlocks



var timeScan = 5000;
var deviceObsoletTime = 0;

/*
function dataBlock(){
	this.deviceName = undefined;
	
	this.macAddress = undefined;
	this.serialNumber = undefined;
	
	this.usedBadge = undefined;
	this.engineCounter = undefined;
	this.bladeCounter = undefined;
	this.moovementCounter = undefined;
	this.openCounter = undefined;
	
	this.bladeClutchCounter = undefined;
	this.mowedSurface = undefined;
}
*/

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
			if (device.getTimeDifferece(oldDevices[indexTempo]) > deviceTimeOut){ // have been a while so it is ok
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



function charCallback(data, isNotification){ // receive data and create one line reply per command
	tempoReplyData = tempoReplyData + data.toString('utf8');
	if (tempoReplyData.endsWith(replyEndLine)){
		var stringreply = tempoReplyData.slice(0,-1)
		eventEmitter.emit('replyData',stringreply);
		tempoReplyData = "";
	}
}



function constructDataFromLine(data,callback){
	var command = commandID[commandSet.getCurrentIndex()];
	switch (command) {
		case "serial":
			currentDataBlock.data.serialNumber = data.trim();
			break;
		case "userblock":
			var input = data.split(";");
			currentDataBlock.data.usedBadge = input[0].trim();
			currentDataBlock.data.engineCounter = input[1].trim();
			currentDataBlock.data.bladeCounter = input[2].trim();
			currentDataBlock.data.moovementCounter = input[3].trim();
			currentDataBlock.data.openCounter = input[4].trim();
			break;
		case "bladeClutch":
			currentDataBlock.data.bladeClutchCounter = data.trim();
			break;
		case "mowedSurface":
			currentDataBlock.data.mowedSurface = data.trim();
			break;
		default:
	}
	callback();
}

eventEmitter.on('replyData',function(dataString){ // one line command is ready
	constructDataFromLine(dataString,function(){
		if (commandSet.hasNext()){
			sendCommand(); // next command
		} else {
			// terminate this device and go next
			fullDataSet.push(currentDataBlock);
			currentDevice.disconnect();
			currentDevice = null;
			processDevice();
		}
	});
});


function sendCommand(){
	var tempoCommand = commandSet.getNext();
	mldpCharCharacteristic.write(tempoCommand,true);
}

function controlCallback(){ // initiate data acquisition for one device
	fullDataSet.length = 0; // empty prevData;
	commandSet.resetIndex();
	sendCommand();
}


/***************************************** NOBLE Callback **************************************/

noble.on('stateChange',function(state) {
	if (state === 'poweredOn') {
		isBlutoothOn = true;
	} else {
		noble.stopScanning();
		isBlutoothOn = false;
	}
});


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
		console.log('connected ');
		currentDevice.once('servicesDiscover',discoverCallback);
		currentDevice.discoverServices([mldpServiceUUID]);	
	}
}

function processDevice(){
	if(devicesToProcess.hasNext()){
		currentDevice = devicesToProcess.getNext().device;
		currentDataBlock = {};
		tempoReplyData = "";
		currentDataBlock.deviceName = currentDevice.advertisement.localName ;
		//currentDataBlock.macAddress = currentDevice.id
		currentDevice.once('connect',onConnectCallback);
		currentDevice.connect();
	} else {
		isScanning = false;
		eventEmitter.emit("dataBlockReady",fullDataSet); // terminate with a bang
	}
}

function stopScanAndProcess(deviceTime){ // processing devices
	noble.stopScanning();
	console.log("detecton stopped");
	filterDevices(detectedDevices,deviceTime,processDevice); // update iterable devices 
}

noble.on('discover', function(peripheral) {
	console.log(peripheral.advertisement.localName);
	detectedDevices.push(peripheral);
});


function startDetection(scanningTime, deviceTimeout){
	console.log("detecton started");
	if (isBlutoothOn && (isScanning == false)){
		isScanning = true;
		timeScan = scanningTime;
		deviceObsoletTime = deviceTimeout;
		detectedDevices.length = 0;
		console.log("Scanning");
		noble.startScanning(mldpServiceUUID);
		setTimeout(stopScanAndProcess,timeScan,deviceObsoletTime);
	}
}







/***************************************** export **************************/

module.exports = {
		isScanning : isBleScanning,
		eventEmitter : eventEmitter,
		startDataDetection : startDetection, 
		cleanUpDeviceMemory : cleanupOldDevices
};








