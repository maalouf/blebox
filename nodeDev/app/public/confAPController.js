
var confApp = angular.module('config', []);

confApp.controller('confAPController',function ($scope,$log,$window,$http) {
	var configFile = {};
	 $http.get('configAP').then(function(res){
		 configFile = res.data;
		 $scope.ap = {
					ssid	:	 configFile.access_point.ssid,
					pass	:	 configFile.access_point.passphrase,
					ip	:	 configFile.access_point.ip_addr,
					net	:	 configFile.access_point.netmask,
					port	:	   configFile.server.port	
				};
	 });

	 $scope.ok = function() {
		 $http.post('/replyConf',$scope.ap);
		 $window.location.href = "choice";
	 };
	 
	 $scope.cancel = function() {
		 $window.location.href = "choice";
	 };
});
