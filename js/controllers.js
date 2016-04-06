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
    
    var enableLoginButton = true;
    
    $scope.login = function() {
        if (enableLoginButton){
            enableLoginButton = false;              
            User.login($scope.username)
            .then(function(username){
                console.log("User logged as "+username);
                $location.path("/windmill");
                
                enableLoginButton = true;
                
            }, function(error){
                if (error === "User already exists.") alert("User already exists, please try again.");
                else if (error === "An error has occurred") alert("An error has occurred, please try again.");
                else {
                    console.error(error);
                }
                enableLoginButton = true;
            });
        }
    }
    
    $scope.enableLogin = false;
    function enableLogin(){
        var username = $scope.username ? $scope.username : '!invalid';
        var regexp = /^[(A-Z)|(a-z)|(0-9)]+$/g;        
        $scope.enableLogin = regexp.test(username);
    }
    $scope.$watch(enableLogin);
})

.controller('windmillCtrl', function($scope, $q, $interval, lit, Navbar, Timers, User, CompactScada) {
    Navbar.view('windmill');
    // signals
    $scope.windSpeed = User.getInitialWindSpeed() === undefined ? 0: User.getInitialWindSpeed();        
    
    function addWindSpeed(value) {
        var windSpeed = $scope.windSpeed;
        if( value > 0) { // if we are adding
            $scope.windSpeed =  windSpeed+value > lit.maxWindSpeed ? lit.maxWindSpeed : windSpeed + value;
        }
        else {          // if we are subtracting
            $scope.windSpeed =  windSpeed+value < 0 ? 0 : windSpeed + value;
        }
    }
    
    // difficult function = 1-sqrt(x)*x
    // x is windSpeed, y is value to increment windSpeed: https://www.google.es/webhp?q=1-sqrt(x+%2F+(32%2F1%5E(2%2F3))+)*(x+%2F+(+32%2F1%5E(2%2F3))+)   
    var y0 = 1;
    var xMax = lit.maxWindSpeed + 2;
    var escalatedXFactor = xMax / Math.pow(y0, 2/3);
    
    $scope.incrementWindSpeed = function() {
        var x = $scope.windSpeed;
        var escalatedX = x / escalatedXFactor;
        var incrementValue = y0 - Math.sqrt(escalatedX) * (escalatedX);
        
        if (x === 0) incrementValue = 5; // fix for some iphones
        
        addWindSpeed(incrementValue);
        
        //----------------------------------------------------
        
        var signals = [{
            id: 'WindSpeed',
            value: $scope.windSpeed
        },{
            id: 'ActivePower',
            value: $scope.activePower
        }];
        
        CompactScada.setSignals(signals).then(function (result){
            // console.log("WindSpeed and ActivePower settled");
        }, function(error){
            console.error(error);
        });        
        
    }
    
    $scope.activePower = 0;
    // function setActivePower(windSpeed){
    //     var activePower = windSpeed <= 0 ? 0 : Math.log(windSpeed+1)*500;  
    //     $scope.activePower = Math.floor(activePower);
    // }
    
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
    tween.pause();
    
    var maxActivePower = Math.log(lit.maxWindSpeed+1)*500;
    function setRotorSpeed(activePower){
        if (activePower === 0) tween.pause();
        else {
            var timeScale = activePower / maxActivePower;
            tween.timeScale(timeScale);
            if (tween.paused()) tween.resume();
        }
    }
    
    // Watch windSpeed
    function reactToWindspeed(windSpeed){
        setWindSpeedPercentage(windSpeed);
        setBarColor(windSpeed);
        $scope.windSpeedFormated = Math.round(windSpeed);
    }
    $scope.$watch('windSpeed', reactToWindspeed, true);        
    
    
    // Timers
    
    // Calculate Active Power
    function getActivePower(activePower){
        var current = activePower;
        var windSpeed = $scope.status ? $scope.windSpeed : 0;
        var target = windSpeed <= 0 ? 0 : Math.log(windSpeed+1)*500;
        
        var distance = target - current;        
        var calculated = current + (distance/4); 
        //calculated = Math.abs(calculated-current) < 50 ? target : calculated; 
        calculated = Math.abs(distance) > 50 ? calculated : target; 
        
        return calculated;
    }
    
    function calculateActivePower() {
        var activePower = $scope.activePower;
        var calculated = getActivePower(activePower);
        //console.log("current: "+activePower+" - new: "+calculated);
        $scope.activePower = Math.floor(calculated);
        setRotorSpeed(calculated);
    }     
    Timers.addTimer(calculateActivePower, lit.updateActivePowerInterval);
    calculateActivePower();
    
    // Update signals
    function updateSignals(){
        
        // CompactScada.getStatus().then(function(status){
        //     $scope.status = status;
        // }, function(error){
        //     console.error(error);
        // });
        
        CompactScada.getStatus().then(function(status){
            $scope.status = status;
            //if (!status) reactToWindspeed($scope.windSpeed);
            var signals = [{
                id: 'WindSpeed',
                value: $scope.windSpeed
            },{
                id: 'ActivePower',
                value: $scope.activePower
            }];
            return CompactScada.setSignals(signals);
        }).then(function (result){
            // console.log("WindSpeed and ActivePower settled");
        }, function(error){
            console.error(error);
        });
    }
    Timers.addTimer(updateSignals, lit.updateSignalsInterval);
    updateSignals();
    
    // Wind Speed decreaser
    function decreaseWindSpeed(){
        addWindSpeed(lit.decreaseValue);
        
        // var equivalentActivePower = Math.exp($scope.windSpeed/500) - 1;
        // setRotorSpeed(getActivePower(equivalentActivePower));
    }
    Timers.addTimer(decreaseWindSpeed, lit.decreaseWindSpeedInterval);
});

})();