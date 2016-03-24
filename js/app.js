'use strict';
(function(){ 

angular.module('app', [
  'ngRoute',
  'app.controllers',
  'app.services'
])

.constant("lit", {
    maxWindSpeed: 30,
    // Decrease WindSpeed Timer
    decreaseWindSpeedInterval: 1000,
    decreaseValue: -2,
    // Windmill rotation animation
    maxWindmillRotationPeriod: 0.75,
    // CompactCADA reference url
    baseUrl: "http://cscadademonight.westeurope.cloudapp.azure.com:8080/api",
    // Update signals timer
    updateSignalsInterval: 3000
})

.config(['$routeProvider', function($routeProvider, $q, $location, Login, User) {
  $routeProvider

  .when('/login', {
    templateUrl: 'templates/login.html',
    controller: 'loginCtrl',
    resolve: {
        checkRoute: checkRouteLogin
    }
  })

  .when('/windmill', {
    templateUrl: 'templates/windmill.html',
    controller: 'windmillCtrl',
    resolve: {
        checkRoute: checkRouteWindmill
    }
  })

  .otherwise({redirectTo: '/login'});
  
  function checkRouteLogin($q, $location, Login, User){
      var deferred = $q.defer();

      if( User.isLogged() ) { // if it's already logged then redirect to windmill
          deferred.reject();
          $location.path('/windmill');
      }
      else if( User.getUsername() ) { // if it's not logged but has storage username
          var username = User.getUsername();          
          Login.checkUserExists(username)
          .then(function(user){
              if (user.exists) {
                  User.reconnect(user.name, user.windSpeed); // not logged but storage username exists, then "reconect"
                  console.log("reconnected!");
                  deferred.reject();
                  $location.path('/windmill');
              }
              else {                  
                  deferred.resolve(); // signal not exists, should login
              }
          }, function (error){
              console.log(error);
          });
      }
      else {
          deferred.resolve(); // rest of cases should login
      }

      return deferred.promise;
  }
  
  function checkRouteWindmill($q, $location, Login, User){ // "inverse"" of checkRouteLogin (change resolve <-> reject)
      var deferred = $q.defer();

      if( User.isLogged() ) { // if it's already logged then ok
          deferred.resolve();
      }
      else if( User.getUsername() ) { // if it's not logged but has storage username 
          var username = User.getUsername();          
          Login.checkUserExists(username)
          .then(function(user){
              if (user.exists) {
                  User.reconnect(user.name, user.windSpeed); // not logged but username storage exists then "reconect"
                  console.log("reconnected!");
                  deferred.resolve(); // resolve with signal value
              }
              else {
                  deferred.reject(); // signal not exists, deny
                  $location.path('/login');
              }
          }, function (error){
              console.log(error);
          });
      }
      else {
          deferred.reject(); // rest of cases deny
          $location.path('/login');
      }

      return deferred.promise;
  }
  
}]);

})();
