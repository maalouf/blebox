var firebase = require('firebase');
var config = require('./database.json');

firebase.initializeApp(config.example);
var database = firebase.database();

 
 function writeData(idRef,data,callback){
	 date = new Date();
	tms = date.toDateString() + " " + date.toLocaleTimeString();
	 database.ref('mowers/' + idRef + '/' + tms).set(data);
	 callback();
 }
 



module.exports = {
		sendData : writeData
};





