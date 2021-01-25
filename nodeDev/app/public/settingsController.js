
var confApp = angular.module('configSet', []);

confApp.directive('stringToNumber', function() {
	  return {
		    require: 'ngModel',
		    link: function(scope, element, attrs, ngModel) {
		      ngModel.$parsers.push(function(value) {
		        return '' + value;
		      });
		      ngModel.$formatters.push(function(value) {
		        return parseInt(value);
		      });
		   }
	};
});

confApp.controller('settingsController',function ($scope,$log,$window,$http) {

	
	$http.get('configSet').then(function(res){
		 time = res.data.conf;
		 $scope.scan = {
			"period" : time.scanPeriod,
			"sweep"	:	time.scanTime,
			"device":	time.obsoletTime
		};
		$scope.zone= res.data.zone;
		$scope.data = {};
	
		$scope.data.continant = time.timeZone.continant;
		$scope.data.city = time.timeZone.place;
		$scope.quiet = {};
		$scope.quiet = time.timeSpan;
		
	 });
	 
	 $scope.ok = function() {
		 dataPost = {
				 "scan" : $scope.scan,
				 "quiet"	:	$scope.quiet,
				 "zone" : $scope.data
		 }
		 $http.post('/replySet',dataPost);
		 $window.location.href = "choice";
	 };
	 
	 $scope.cancel = function() {
		 $window.location.href = "choice";
	 };
});