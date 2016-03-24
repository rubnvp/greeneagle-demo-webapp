'use strict';
(function(){ 

angular.module('app.controllers', ['app.services'])

.controller('navbarCtrl', function($scope, $location, Navbar, User) {
    $scope.view = null; 
    Navbar.view = function(view) {
        $scope.view = view;
    };
    
    $scope.logged = false;
    $scope.username = undefined; 
    Navbar.logged = function(logged, username) {
        $scope.logged = logged;
        $scope.username = username;
    }        
    
    $scope.navbarTitle = undefined;
    function setNavbarTitle(){
        switch ($scope.view){
            case 'login': 
                $scope.navbarTitle = "Welcome!";
            break;
            case 'windmill':
                $scope.navbarTitle = !$scope.logged ? "Not logged" : $scope.username;
            break;
            default: 
        }
    }
    $scope.$watch(setNavbarTitle);
    
    $scope.logout = function() {
        User.logout().then(function(username){
            console.log("User "+username+" is logged out");
            $location.path("/login");
        }, function(error){
            console.error(error);
        });
    }
})

.controller('loginCtrl', function($scope, $location, Navbar, User) {
    Navbar.view('login');    

    $scope.username =  undefined;
    
    $scope.login = function() {
        User.login($scope.username)
        .then(function(username){
            console.log("User logged as "+username);
            $location.path("/windmill");
        }, function(error){
            if (error = "User already exists.") alert("User already exists, try again.");
            else {
                console.error(error);
            }
        });
    }
    
    $scope.enableLogin = false;
    function enableLogin(){
        var username = $scope.username ? $scope.username : '!invalid';
        var regexp = /^[(A-Z)|(a-z)|(0-9)]+$/g;        
        $scope.enableLogin = regexp.test(username);
    }
    $scope.$watch(enableLogin);
})

.controller('windmillCtrl', function($scope, $interval, lit, Navbar, Timers, User, CompactScada) {
    Navbar.view('windmill');
    // signals
    $scope.windSpeed = User.getInitialWindSpeed() === undefined ? 0: User.getInitialWindSpeed();        
    
    function addWindSpeed(value) {
        var windSpeed = $scope.windSpeed;
        if ($scope.status) {
            if( value > 0) { // if we are adding
                $scope.windSpeed =  windSpeed+value > lit.maxWindSpeed ? lit.maxWindSpeed : windSpeed + value;
            }
            else {          // if we are subtracting
                $scope.windSpeed =  windSpeed+value < 0 ? 0 : windSpeed + value;
            }
        }
    }
    $scope.addWindSpeed = addWindSpeed;
    
    $scope.activePower = 0;
    function setActivePower(windSpeed){
        var activePower = windSpeed <= 0 ? 0 : Math.log(windSpeed)*500;  
        $scope.activePower = Math.floor(activePower);
    }
    
    $scope.windSpeedPercentage = 0;
    function setWindSpeedPercentage(windSpeed){
        var percentage =  (windSpeed / lit.maxWindSpeed ) * 100;
        $scope.windSpeedPercentage = Math.floor(percentage);
    }
    
    $scope.status = false;

    $scope.barColor = "hsla(10, 70%, 50%, 1)"; // hueMin
    function setBarColor(windSpeed){
        var percentage =  (windSpeed / lit.maxWindSpeed ) * 100;
        var hueMin = 10;
        var hueMax = 130;
        var hue = hueMin + (hueMax-hueMin) * percentage/100;
        $scope.barColor = "hsla("+Math.floor(hue)+", 70%, 50%, 1)";
    }
    
    // Tween to control windmill rotation    
    var tween = TweenMax.to('#windmill-rotor', lit.maxWindmillRotationPeriod, {
        rotation: "360deg", 
        ease: Power0.easeNone,
        repeat: -1
    });  
    
    function setRotorSpeed(windSpeed, oldWindSpeed){
        if (windSpeed === 0) tween.pause();
        else {
            var timeScale = windSpeed / lit.maxWindSpeed;
            tween.timeScale(timeScale);
            if (oldWindSpeed === 0) tween.resume();
        }
    }
    
    // Watch windSpeed
    $scope.$watch('windSpeed', function(windSpeed, oldWindSpeed){        
        setActivePower(windSpeed);
        setWindSpeedPercentage(windSpeed);
        setBarColor(windSpeed);
        setRotorSpeed(windSpeed, oldWindSpeed);               
    }, true);        
    
    
    // Timers    
    
    // Wind Speed decreaser
    function decreaseWindSpeed(){
        addWindSpeed(lit.decreaseValue);
    }
    Timers.addTimer(decreaseWindSpeed, lit.decreaseWindSpeedInterval);
    
    // Update signals
    function updateSignals(){
        CompactScada.getStatus().then(function(status){
            $scope.status = status;
            if (!status) $scope.windSpeed = 0;
        }, function(error){
            console.error(error);
        });
        CompactScada.setWindSpeed($scope.windSpeed).then(function(result) {
            // on success do nothing
        }, function(error) {
            console.error(error);
        });
    }
    Timers.addTimer(updateSignals, lit.updateSignalsInterval);
    updateSignals();
});

})();