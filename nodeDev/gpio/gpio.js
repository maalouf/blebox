var events = require('events');
var eventEmitter = new events.EventEmitter();

var blinkyTimer = null;
var blinkyVal = 1;

var blinkyTimer2 = null;
var blinkyVal2 = 1;

var Gpio = require('onoff').Gpio,
	led1 = new Gpio(3, 'out'),
	led2 = new Gpio(4, 'out'),
	button = new Gpio(2, 'in', 'rising');
	
var rebound = true;

button.watch(function (err, value) {
	 if (err) {
	   throw err;
	 }
	 if ((value == 1) && (rebound)){
		 rebound = false;
		 eventEmitter.emit('buttonClick');
		 setTimeout(function(){rebound = true;},700);
	 }
});


function controlLED1(value){
	led1.writeSync(value);
};
	
function controlLED2(value){
	led2.writeSync(value);
}

process.on('SIGINT', function () {
	 led1.unexport();
	 led2.unexport();
	 button.unexport();
});

/********* interface ******************/

function _signal_accessPoint(){
	if (blinkyTimer == null){
		blinkyTimer = setInterval(function(){
			led1.writeSync(blinkyVal);
			blinkyVal = 1- blinkyVal;
		},300);
	}
}

function _stopBlinky(callback){
	if (blinkyTimer != null){
		clearInterval(blinkyTimer);
		led1.writeSync(0);
		blinkyVal = 1;
		blinkyTimer = null;
	}
	typeof callback === 'function' && callback();
}

function _signal_internetOk(){
	_stopBlinky(function(){
		led1.writeSync(1);
	});
	
}

function _signal_emitting(){
	if (blinkyTimer2 == null){
		blinkyTimer2 = setInterval(function(){
			led2.writeSync(blinkyVal2);
			blinkyVal2 = 1- blinkyVal2;
		},300);
	}
}


function _signal_ScanningState(state){
	if (blinkyTimer2 != null){
		clearInterval(blinkyTimer2);
		blinkyVal2 = 1;
		blinkyTimer2 = null;
	}
	var val = state ? 1 : 0;
	led2.writeSync(val);
}

/***********************************/

module.exports = {
		LED1Control : controlLED1,
		LED2Control : controlLED2,
		signal_AP :  _signal_accessPoint,
		signal_net_ok : _signal_internetOk,
		stop_AP_Signal : _stopBlinky,
		signal_scanning :  _signal_ScanningState,
		signal_emitting : _signal_emitting,
		events : eventEmitter
};