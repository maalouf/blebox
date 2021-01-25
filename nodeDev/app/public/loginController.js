
var logApp = angular.module('plunker', ['ui.bootstrap']);



var ModalInstanceCtrlPass = function ($scope, $modalInstance, data) {
  $scope.pass = {old : data.old , newp1 : data.newp1 , newp2 : data.newp2};
  $scope.okPass = function () {
    $modalInstance.close($scope.pass);
  };

  $scope.cancelPass = function () {
    $modalInstance.dismiss('cancel');
  };
};


logApp.controller('ModalCtrl',function ($scope, $modal, $log,$window, $http) {

	  $scope.items = ['Configure WIFI Client', 'Reconfigure Access Point', 'Set Application Parameters'];
	  $scope.user = {};
	  $scope.pass = {};
	  
	  
	  $scope.open = function () { //password change

	    var modalInstance = $modal.open({
	      templateUrl: 'myPassContent.html',
	      controller: ModalInstanceCtrlPass,
	      resolve: {
	        data: function () {
	          return $scope.pass;
	        }
	      }
	    });

	    modalInstance.result.then(function (dataPass) {
	    	$http.get('external/intPass.json').then(function(result){
	    		
	    		if((dataPass.old == result.data.password ) && (dataPass.newp1 == dataPass.newp2 )) {
	    			var jdata = {"userName"	:	result.data.userName,
    						"password"	:	dataPass.newp1};
	    			 $http.post('/replyLog',jdata);
	    			 $scope.message = "Password change OK";
	    		} else {
	    			$scope.message = "Password change failed (something dont match)";
	    		}
	    	}); 
	    }, function () {
	      $log.info('Modal dismissed at: ' + new Date());
	    });
	  };
	  
	  
	  
	  $scope.logMeIn = function() {
		  $http.get('external/intPass.json').then(function(result){
			  
	    		if(($scope.user.name == result.data.userName) && ($scope.user.pass == result.data.password )) {
	    			$window.location.href = "choice";
		  		} else {
		  			$scope.message = "Login ERROR";
		  		}
		  	});
		
	  };

	});
