var _       = require("underscore")._,
    async   = require("async"),
    fs      = require("fs"),
    exec    = require("child_process").exec,
    config  = require("./config.json");
	

// Better template format
_.templateSettings = {
    interpolate: /\{\{(.+?)\}\}/g,
    evaluate :   /\{\[([\s\S]+?)\]\}/g
};

// Helper function to write a given template to a file based on a given
// context
function write_template_to_file(template_path, file_name, context, callback) {
    async.waterfall([

        function read_template_file(next_step) {
            fs.readFile(template_path, {encoding: "utf8"}, next_step);
        },

        function update_file(file_txt, next_step) {
            var template = _.template(file_txt);
            fs.writeFile(file_name, template(context), next_step);
        }

    ], callback);
}



/*****************************************************************************\
    Return a set of functions which we can use to manage and check our wifi
    connection information
\*****************************************************************************/
module.exports = function() {

	
    // Detect which wifi driver we should use, the rtl871xdrv or the nl80211
    exec("iw list", function(error, stdout, stderr) {
        if (stderr.match(/^nl80211 not found/)) {
            config.wifi_driver_type = "rtl871xdrv";
        }
        // console.log("config.wifi_driver_type = " + config.wifi_driver_type);
    });

    // Hack: this just assumes that the outbound interface will be "wlan0"

    // Define some globals
    var ifconfig_fields = {
        "hw_addr":         /HWaddr\s([^\s]+)/,
        "inet_addr":       /inet addr:([^\s]+)/,
    },  iwconfig_fields = {
        "ap_addr":         /Access Point:\s([^\s]+)/,
        "ap_ssid":         /ESSID:\"([^\"]+)\"/,
        "unassociated":    /(unassociated)\s+Nick/,
    },  last_wifi_info = null;

    // TODO: rpi-config-ap hardcoded, should derive from a constant

    // Get generic info on an interface
    var _get_wifi_info = function(callback) {
        var output = {
            hw_addr:      "<unknown>",
            inet_addr:    "<unknown>",
            unassociated: "<unknown>",
        };

        // Inner function which runs a given command and sets a bunch
        // of fields
        function run_command_and_set_fields(cmd, fields, callback) {
            exec(cmd, function(error, stdout, stderr) {
                if (error) return callback(error);
                for (var key in fields) {
                    re = stdout.match(fields[key]);
                    if (re && re.length > 1) {
                        output[key] = re[1];
                    }
                }
                callback(null);
            });
        }

        // Run a bunch of commands and aggregate info
        async.series([
            function run_ifconfig(next_step) {
                run_command_and_set_fields("ifconfig wlan0", ifconfig_fields, next_step);
            },
            function run_iwconfig(next_step) {
                run_command_and_set_fields("iwconfig wlan0", iwconfig_fields, next_step);
            },
        ], function(error) {
            last_wifi_info = output;
            return callback(error, output);
        });
    },
    _reboot_wireless_network = function(wlan_iface, callback) {
        async.series([
            function down(next_step) {
                exec("sudo ifdown " + wlan_iface, function(error, stdout, stderr) {
                    if (!error) console.log("ifdown " + wlan_iface + " successful...");
                    next_step();
                });
            },
            function up(next_step) {
                exec("sudo ifup " + wlan_iface, function(error, stdout, stderr) {
                    if (!error) console.log("ifup " + wlan_iface + " successful...");
                    next_step();
                });
            },
        ], callback);
    },
    
    _get_Service_Status = function(service,result){
    	 var cmdStr = "service " + service + " status";
    	 exec(cmdStr, function(error, stdout, stderr) {
             re = stdout.match(/Active:\s([^\s]+)\s\(([^\s]+)\)/);
             if (re[1] == 'inactive' || re[2] == 'exited'){
            	 result(false,re[1],re[2]);
             } else {
            	 result(true,re[1],re[2]);
             }
         });
    },

    // Wifi related functions
    _is_wifi_enabled_sync = function(info) {
	console.log(info);
    	if(info.hasOwnProperty('ap_addr')){
    		return ((info['ap_addr'] != 'Not-Associated') && ( "<unknown>" != info["inet_addr"]));
    	} else {
    		return false;
    	}
        
    },

    _is_wifi_enabled = function(callback) {
        _get_wifi_info(function(error, info) {
            if (error) return callback(error, null);
            return callback(null, _is_wifi_enabled_sync(info));
        });
    },

    // Access Point related functions
    _is_ap_enabled_sync = function(info) {
        var ret =  (!info.hasOwnProperty('ap_addr')) && (info["inet_addr"] == config.access_point.ip_addr);
        return ret;
    },

    _is_ap_enabled = function(callback) {
        _get_wifi_info(function(error, info) {
            if (error) return callback(error, null);
            return callback(null, _is_ap_enabled_sync(info));
        });
    },

    // Enables the accesspoint w/ bcast_ssid. This assumes that both
    _enable_ap_mode = function(callback) {
            var context = config.access_point;
            var nbError = 0;
            context["enable_ap"] = true;
            context["wifi_driver_type"] = config.wifi_driver_type;

            // Here we need to actually follow the steps to enable the ap
            async.series([
                function disableAPifActive(next_step){
                	 _get_Service_Status('hostapd',function(status,a,b){
                		 if (status){
                			 exec("service hostapd stop", function(error, stdout, stderr) {
                                 next_step();
                             });
                		 }else {
                			 next_step();
                		 }
                	 });
                },

                // Enable the access point ip and netmask + static
                // DHCP for the wlan0 interface
                function update_interfaces(next_step) {
                    write_template_to_file(
                        "./assets/etc/network/interfaces.ap.template",
                        "/etc/network/interfaces",
                        context, next_step);
                },

                // Enable DHCP conf, set authoritative mode and subnet
                function update_dhcpd(next_step) {
                    var context = config.access_point;
                    // We must enable this to turn on the access point
                    write_template_to_file(
                        "./assets/etc/dhcp/dhcpd.conf.template",
                        "/etc/dhcp/dhcpd.conf",
                        context, next_step);
                },

                // Enable the interface in the dhcp server
                function update_dhcp_interface(next_step) {
                    write_template_to_file(
                        "./assets/etc/default/isc-dhcp-server.template",
                        "/etc/default/isc-dhcp-server",
                        context, next_step);
                },

                // Enable hostapd.conf file
                function update_hostapd_conf(next_step) {
                    write_template_to_file(
                        "./assets/etc/hostapd/hostapd.conf.template",
                        "/etc/hostapd/hostapd.conf",
                        context, next_step);
                },

                function update_hostapd_default(next_step) {
                    write_template_to_file(
                        "./assets/etc/default/hostapd.template",
                        "/etc/default/hostapd",
                        context, next_step);
                },

                function reboot_network_interfaces(next_step) {
                    _reboot_wireless_network(context.wifi_interface, next_step);
                },

                function restart_dhcp_service(next_step) {
                    exec("service isc-dhcp-server restart", function(error, stdout, stderr) {
                       if(error){
                     	   console.log("... dhcp server ERROR! ... retry"); 
                     	   nbError = nbError + 1;
                     	   if (nbError > 6){
                     		   next_step(true);
                     	   } else {
                     		 restart_dhcp_service(next_step);  
                     	   }
                       } else {
                    	   console.log("... dhcp server restarted!");
                    	   nbError = 0;
                    	    next_step();
                       }   
                    });
                },

                function restart_hostapd_service(next_step) {
                    exec("service hostapd restart", function(error, stdout, stderr) {
                        console.log(stdout);
                        if(error){
                      	   console.log("... hostapd server ERROR! ... retry"); 
                      	   nbError = nbError + 1;
                      	   if (nbError > 6){
                      		   next_step(true);
                      	   } else {
                      		 restart_hostapd_service(next_step);  
                      	   }
                        } else {
                           console.log("... hostapd restarted!")
                     	   nbError = 0;
                     	   next_step();
                        }    
                    });
                }
                // TODO: Do we need to issue a reboot here?

            ],function(err, results) {
               callback(err);
          });
    },
    
    _enable_wifi_mode = function(connection_info,callback){
    	 async.series([
    	                // Update /etc/network/interface with correct info...
    	                function update_interfaces(next_step) {
    	                	if (connection_info.lan_type == "dhcp"){
    	                    	write_template_to_file("./assets/etc/network/interfaces.wifi.landhcp.template",
    	                                "/etc/network/interfaces",
    	                                connection_info, next_step);
    	                	} else {
    	                		console.log("writing lan wlan");
    	                		write_template_to_file(
    	                                "./assets/etc/network/interfaces.wifi.lan.template",
    	                                "/etc/network/interfaces",
    	                                connection_info, next_step);
    	                	}
    	                },

    	                // Stop the DHCP server...
    	                function restart_dhcp_service(next_step) {
    	                    exec("service isc-dhcp-server stop", function(error, stdout, stderr) {
    	                        //console.log(stdout);
    	                        if (!error) console.log("... dhcp server stopped!");
    	                        next_step();
    	                    });
    	                },
    	                
    	                function restart_hostapd_service(next_step) {
    	                    exec("service hostapd stop", function(error, stdout, stderr) {
    	                        //console.log(stdout);
    	                        if (!error) console.log("... hostapd server stopped!");
    	                        next_step();
    	                    });
    	                },

    	                function reboot_network_interfaces(next_step) {
    	                    _reboot_wireless_network(config.wifi_interface, next_step);
    	                },

    	            ],function(err, results) {
    	                callback(err);
    	            });
    },

    // Disables AP mode and reverts to wifi connection
    _enable_lan_mode = function(connection_info, callback) {
    	
            async.series([
                // Update /etc/network/interface with correct info...
                function update_interfaces(next_step) {
                	if (connection_info.lan_type == "dhcp"){
                		console.log("ici ij");
                    	write_template_to_file("./assets/etc/network/interfaces.wifi.landhcp.template",
                                "/etc/network/interfaces",
                                connection_info, next_step);
                	} else {
                		write_template_to_file(
                                "./assets/etc/network/interfaces.wifi.lan.template",
                                "/etc/network/interfaces",
                                connection_info, next_step);
                	}
                },

                // Stop the DHCP server...
                function restart_dhcp_service(next_step) {
                    exec("service isc-dhcp-server stop", function(error, stdout, stderr) {
                        //console.log(stdout);
                        if (!error) console.log("... dhcp server stopped!");
                        next_step();
                    });
                },
                
                function restart_hostapd_service(next_step) {
                    exec("service hostapd stop", function(error, stdout, stderr) {
                        //console.log(stdout);
                        if (!error) console.log("... hostapd server stopped!");
                        next_step();
                    });
                },

                function reboot_network_interfaces(next_step) {
                	exec("sudo /etc/init.d/networking restart", function(error, stdout, stderr) {
                		next_step(error);
                	});
                }

            ],function(err, results) {
                callback(err);
            });

    };

    return {
        get_wifi_info:           _get_wifi_info,
        reboot_wireless_network: _reboot_wireless_network,

        is_wifi_enabled:         _is_wifi_enabled,
        is_wifi_enabled_sync:    _is_wifi_enabled_sync,
        get_service_status:		 _get_Service_Status,
        is_ap_enabled:           _is_ap_enabled,
        is_ap_enabled_sync:      _is_ap_enabled_sync,
        
        enable_lan_mode : 		 _enable_lan_mode,
        enable_ap_mode:          _enable_ap_mode,
        enable_wifi_mode:        _enable_wifi_mode
    };
}
