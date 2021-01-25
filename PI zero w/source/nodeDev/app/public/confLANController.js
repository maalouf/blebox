 

var confLan = angular.module('radioExample', []);

confLan.controller('ExampleController',function ($scope,$log,$window,$http) {
		$http.get('configHist').then(function(res){
			 data = res.data;
			 if (data.lan.type == 'dhcp'){
				 $scope.type = 'false';
			 } else {
				 $scope.type = 'true';
			 }
			 $scope.lan = data.lan;
		});
			
		
		 $scope.ok = function() {
			 data = $scope.lan;
			 data.type = ($scope.type == 'false') ? 'dhcp' : 'static';
			 $http.post('/replyLan',data);
			 $window.location.href = "choice";
		 };
		 
		 $scope.cancel = function() {
			 $window.location.href = "choice";
		 };

    });
