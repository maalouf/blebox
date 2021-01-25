var admin = require("firebase-admin");
var fs      = require("jsonfile");
var serviceAccount = require("./OperationDatabaseEtesia-74383e077b4e.json");

var defaultApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://etesia-febe7.firebaseio.com"
});

var defaultAuth = defaultApp.auth();
var database = defaultApp.database();

function pad(n) {
    return (n < 10) ? ("0" + n.toString()) : n.toString();
}

function getTimeStamp(){
	date = new Date();
	result = pad(date.getMonth() + 1) + pad(date.getDate())  + date.getFullYear().toString() +
	pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
	return result;
}

function suiteUpData(dataIn){
	data = fs.readFileSync("./database/dataSqueleton.json");
	for (var attrib in data){
		if (dataIn.hasOwnProperty(attrib)){
			data[attrib] = dataIn[attrib];
		}
	}

	
	return data;
}

function getRefID(id){
	return parseInt(id.substring(0, 5),16);
}

function writeData(id,dataIn,callback){
	 
	 tms = getTimeStamp();
	 data = suiteUpData(dataIn);
	 idRef = getRefID(id).toString();
	 data.NumeroSerie = idRef;
	 data.NbHeuresTotalMachine = data.NbHeureMoteur;
	 data.BluetoothID = id;

	 
	 console.log("sending as id " + idRef + " and time : " + tms + " Data: ");
	 console.log(data)
	 database.ref('History/MowerHistory/' + idRef + '/' + tms).set(data);
	 callback();
}




module.exports = {
		sendData : writeData
};




