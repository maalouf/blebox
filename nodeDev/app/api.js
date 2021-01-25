var path       = require("path"),
    util       = require("util"),
    iwlist     = require("../wifiApp/iwlist"),
    express    = require("express"),
    bodyParser = require('body-parser'),
    config     = require("../wifiApp/config.json"),
    http_test  = config.http_test_only;

var portCheck = require('tcp-port-used');
var configurator = require('../configurator/configuration')

// Helper function to log errors and send a generic status "SUCCESS"
// message to the caller
function log_error_send_success_with(success_obj, error, response) {
    if (error) {
        console.log("ERROR: " + error);
        response.send({ status: "ERROR", error: error });
    } else {
        success_obj = success_obj || {};
        success_obj["status"] = "SUCCESS";
        response.send(success_obj);
    }
    response.end();
}

function msToTime(duration) {
    milliseconds = parseInt((duration%1000)/100), seconds = parseInt((duration/1000)%60)
            , minutes = parseInt((duration/(1000*60))%60), hours = parseInt((duration/(1000*60*60))%24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return {
       "hour" :  hours,
        "min" :  minutes,
        "sec" : seconds
    };
}

/*****************************************************************************\
    Returns a function which sets up the app and our various routes.
\*****************************************************************************/
module.exports = function(wifi_manager, callback,dipatcherCallback) {
	
	
	portCheck.check(config.server.port,'127.0.0.1').then(function(inuse){
		if (!inuse){
			 var app = express();
			    
			    process.on('uncaughtException', function (err) {
			        console.log('UNCAUGHT EXCEPTION - keeping process alive:', err); // err.message is "foobar"
			    });
			    // Configure the app
			    app.set("view engine", "ejs");
			    app.set("views", path.join(__dirname, "views"));
			    app.set("trust proxy", true);

			    // Setup static routes to public assets
			    app.use(express.static(path.join(__dirname, "public")));
			    app.use(bodyParser.json());

			    // Setup HTTP routes for rendering views
			    app.get("/", function(request, response) {
			    	response.render("index");
			    });
			    
			    /************* conf files **************/
		    
			    app.get("/configAP",function(request, response){
			    	
			    	test = configurator.readAP();
			    	response.writeHead(200, {"Content-Type": "application/json"});
			    	response.end(JSON.stringify(test));
			    });
			    
			    app.get("/configHist",function(request, response){ //send history setting json
			    	data = configurator.read_settings_backup();
			    	response.writeHead(200, {"Content-Type": "application/json"});
			    	response.end(JSON.stringify(data));
			    });
			    
			    app.get("/configSet",function(request, response){
			    	test = configurator.readSet();
			    	tim = configurator.readZoneList();
			    	dataSent = {
			    		"conf" : {
			    				"scanPeriod" : msToTime(test.scanningPeriode),
			    				"scanTime" : msToTime(test.scanningTime),
			    				"obsoletTime" : msToTime(test.obsoletTimeOut),
			    				"timeZone"	:	test.timeZone,
			    				"timeSpan"	:	test.timeSpan
			    		},
			    		"zone" : tim
			    	};
	
			    	response.writeHead(200, {"Content-Type": "application/json"});
			    	response.end(JSON.stringify(dataSent));
			    });
			    
			    
			    app.post("/replyConf",function(request, response){ // json Access point
			    	configurator.saveAPData(request.body,function(err){
			    		dipatcherCallback("APConfOK",err);
			    	});
			    });
			    
			    app.post("/replyLog",function(request, response){ // json login admin
			    	console.log(request.body);
			    	configurator.saveAdminData(request.body);
			    });
			    
			    app.post("/replySet",function(request, response){ // json settings
			    	console.log(request.body);
			    	configurator.saveProgramSettings(request.body,function(err){
			    		if (!err){
			    			dipatcherCallback("SettingsOK");
			    		} else {
			    			dipatcherCallback("SettingsKO");
			    		}
			    	});
			    });
			    
			    app.post("/replyLan",function(request, response){ // json settings
			    	data = configurator.read_settings_backup();
			    	data.lan = request.body;
			    	var conn_info = {
					    wifi_ssid: data.wifi.ssid,
					    wifi_passcode: data.wifi.password,
					    lan_type :data.lan.type,
					    lan_ip	: data.lan.ip_adr,
					    lan_mask	:	data.lan.netmask,
					    lan_gateway	:	data.lan.gateway,
					    lan_broadcast	:	data.lan.broadcast,
					    lan_dns	:	data.lan.dns,
					 };
			    	wifi_manager.enable_lan_mode(conn_info,function(){
			    		configurator.write_settings_backup(data);
			    		console.log("Lan should be ok");
			    		dipatcherCallback("lanEnabled");
			    	})
			    });
			    
			    
			   /*****************************************************/
			    
			    app.get("/choice",function(request, response){
			    	response.render('choice');
			    });
			    
			    app.get("/lanConfig",function(request, response){
			    	response.render('ethernet');
			    });
			    
			    
			    app.get("/wifiscan",function(request,response){
			    	response.render('wifiscan');
			    });
			    
			    app.get("/appConfig",function(request,response){
			    	response.render('confAP');
			    });
			    
			    app.get("/appSettings",function(request,response){
			    	response.render('app_settings');
			    });
			    

			    // Setup HTTP routes for various APIs we wish to implement
			    // the responses to these are typically JSON
			    app.get("/api/rescan_wifi", function(request, response) {
			        console.log("Server got /rescan_wifi");
			        iwlist(function(error, result) {
			            log_error_send_success_with(result[0], error, response);
			        });
			    });

			    app.post("/api/enable_wifi", function(request, response) {
			    	var backups = configurator.read_settings_backup();
			        var conn_info = {
			            wifi_ssid:      request.body.wifi_ssid,
			            wifi_passcode:  request.body.wifi_passcode,
			            lan_type : backups.lan.type,
			            lan_ip	:	backups.lan.ip_adr,
			            lan_mask	:	backups.lan.netmask,
			            lan_gateway	:	backups.lan.gateway,
			            lan_broadcast	:	backups.lan.broadcast,
			        	lan_dns	:	backups.lan.dns,
			        };
			         console.log(conn_info);
			         backups.wifi.ssid = conn_info.wifi_ssid;
			        backups.wifi.password = conn_info. wifi_passcode;
			        configurator.write_settings_backup(backups);
			       
			      wifi_manager.enable_wifi_mode(conn_info, function(error) {
			        wifi_manager.is_wifi_enabled(function(err,enb){
						if((enb == false) || (error)){
				            console.log("Enable Wifi ERROR: " + error);
				            console.log("Attempt to re-enable AP mode");
				            wifi_manager.enable_ap_mode(function(error) {
				                console.log("... AP mode reset");
				            	response.redirect("/wifiscan");
							});
				        } else {
				        	console.log("Wifi Enabled! - Exiting");
				        	dipatcherCallback("wifiEnabled");
				        }			
			        });

			    });

			    });

			    // Listen on our server
			    app.listen(config.server.port);
		} else {
			console.log("in use ...");
		}
	    callback();
	}, function(error){
		console.log("error");
		callback();
	});
   
}
