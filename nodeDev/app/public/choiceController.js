
var choiceApp = angular.module('choice', []);

choiceApp.controller('choiceCtrl',function ($scope,$log,$window,$http) {
	
	
	$scope.bt1click = function(){
		$scope.active='Set Wifi';
		$window.location.href = "wifiscan";
	};
	
	$scope.bt2click = function(){
		$scope.active='Application Settings';
		$window.location.href = "appSettings";
	};
	
	$scope.bt3click = function(){
		$scope.active='Wifi Access Point config';
		$window.location.href = "appConfig";
	};
	
	$scope.bt4click = function(){
		$scope.active='Ethernet (eth0) config';
		$window.location.href = "lanConfig";
	};
	
});
