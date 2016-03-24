'use strict';
(function(){ 

angular.module('app.services', [])

.factory('Navbar', function(){
    // will be overwrite by navbarCtrl
    var Service = {
        view: null,
        logged: null,
        loggedAs: null
    };     
    return Service;
})

.factory('User', function($q, $window, Login, Navbar, Timers){
    var logged = false;
    var username = $window.localStorage.getItem("username"); // null at first time
    var initialWindSpeed = undefined; // fill if reconnect succeed
    
    function isLogged() {
        return logged;
    }
    
    function getUsername() {
        return username;
    }
    
    function getInitialWindSpeed() {
        return initialWindSpeed;
    }
    
    // ----- Login
    function login(username) {
        return Login.login(username)
        .then(function(newUsername) {
            setLogin(newUsername);
            return $q.when(newUsername);
        });
    }
    
    function reconnect(_username, windSpeed){
        setLogin(_username);
        initialWindSpeed = windSpeed;
    }
        
    function setLogin(_username) {
        logged = true;
        username = _username;
        $window.localStorage.setItem("username", username);
        Navbar.logged(true, username);
    }
    
    // ----- Logout
    function logout() {        
        return Login.logout(username)
        .then(function (oldUsername){
            setLogout();
            return $q.when(oldUsername);
        });                
    }
    
    function setLogout() {       
        logged = false;
        username = undefined;
        initialWindSpeed = undefined;
        $window.localStorage.removeItem("username");
        Timers.clearAll();
        Navbar.logged(false, undefined);
    }
    
    var Service = {
        isLogged: isLogged,
        getUsername: getUsername,
        getInitialWindSpeed: getInitialWindSpeed,
        login: login,
        reconnect: reconnect,
        logout: logout
    };     
    return Service;
})

.factory('Login', function ($q, CompactScadaAPI, Random){
    function checkUserExists(username){
        var deferred = $q.defer();      
        CompactScadaAPI.getSignal(username, "WindSpeed") // we just check if signal "WTG.username.WindSpeed" exists
        .then(function(value){
            if (value === undefined) {
                deferred.resolve({
                    exists: false,
                    name: username,
                    windSpeed: undefined
                });
            }
            else {
                deferred.resolve({
                    exists: true,
                    name: username,
                    windSpeed: value
                });
            }
        });               
        return deferred.promise; 
    }
    
    function login(originalUsername){
        var username = originalUsername + '_' + Random.randomInt(0, 200);            
        
        return checkUserExists(username)
        .then(function(user){
            if (user.exists) return $q.reject("User already exists."); // collision
            var signals = [
                {
                    Name: "WTG."+username+".WindSpeed",
                    Type: "DOUBLE",
                    InitialQuality : 0xC0,
                    InitialValue: 0
                },  
                {
                    Name: "WTG."+username+".Status",
                    Type: "BOOL",
                    InitialQuality : 0xC0,
                    InitialValue: true
                },
            ];
            return CompactScadaAPI.createSignals(signals);
        })
        .then(function(result){
            if (result.data.WrittenItems !== 2) return $q.reject("An error has occurred, please try again.");
            return $q.when(username);
        });
    }
    
    function logout(username){
        var signals = ["WTG."+username+".WindSpeed", "WTG."+username+".Status"];
        return CompactScadaAPI.deleteSignals(signals)
        .then(function(){
            return $q.when(username);
        });
    }
    
    var Service = {
        checkUserExists: checkUserExists,
        login: login,
        logout: logout
    };     
    return Service;
})

.factory('CompactScadaAPI', function($http, lit){
    var baseSignal = "WTG";
    
    function getSignal(username, signal) {
        var jsonPost = baseSignal+'.'+username+'.'+signal;
        return $http.post(lit.baseUrl+'/itemsFromPattern', jsonPost).then(function(result){
            var value = ( result.data && result.data[0] && result.data[0].Value !== undefined ) ? result.data[0].Value : undefined;
            return value;
        });
    }
    
    function setSignal(username, signal, value){
        var finalSignal = baseSignal+'.'+username+'.'+signal;
        var jsonPost = [{
            Name: finalSignal,
            Value: value
        }];
        return $http.post(lit.baseUrl+'/item', jsonPost);
    }
    
    function createSignals(signals){
        return $http.post(lit.baseUrl+'/item/create', signals);
    }
    
    function deleteSignals(signals){
        var config = { data: signals };
        return $http.delete(lit.baseUrl+'/item/delete', config);
    }        
    
    var Service = {
        getSignal: getSignal,
        setSignal: setSignal,
        createSignals: createSignals,
        deleteSignals: deleteSignals
    };     
    return Service;
})

.factory('CompactScada', function($q, User, CompactScadaAPI){
    function getStatus() {
        if ( User.isLogged() ) {
            return CompactScadaAPI.getSignal(User.getUsername(), 'Status');
        }
        else {
            return $q.reject("User not logged.");
        }        
    }        
    
    function setWindSpeed(windSpeed){
        if ( User.isLogged() ) {
            return CompactScadaAPI.setSignal(User.getUsername(), 'WindSpeed', windSpeed);
        }
        else {
            return $q.reject("User not logged.");
        }
    }
    
    var Service = {
        getStatus: getStatus,
        setWindSpeed: setWindSpeed
    };     
    return Service;
})

.factory('Timers', function($interval){
    var updateSignals = null;
    var decreaseWindSpeed = null;
    var timers = [];
    
    function addTimer(action, interval){
        var timer = $interval(action, interval);
        timers.push(timer);
    }
    
    function clearAll(){
        timers.forEach(function(interval){
            $interval.cancel(interval);
        });
        timers = [];
    }
    
    var Service = {
        addTimer: addTimer,
        clearAll: clearAll
    };
    return Service;
})

.factory('Random', function(){
    var superheroes = [
        "Adam-Strange", "Aquaman", "Ant-Man", "Barbara-Gordon", "Batman", "Beast", "Black-Canary", "Black-Lightning", 
        "Black-Panther", "Black-Widow", "Blade", "Blue-Beetle", "Booster-Gold", "Bucky-Barnes", "Captain-America", 
        "Captain-Britain", "Captain-Marvel", "Catwoman", "Cerebus", "Cyclops", "Daredevil", "Dashiell-Bad-Horse", 
        "Deadpool", "Donna-Troy", "Dr-Strange", "Dream-of-the-Endless", "Elijah-Snow", "Fone-Bone", "Gambit", "Ghost-Rider", 
        "Green-Arrow", "Groo", "Green-Lantern", "Hawkeye", "Hawkman", "Hellboy", "Human-Torch", "Invisible-Woman", "Iron-Fist", 
        "Iron-Man", "James-Gordon", "Jean-Grey", "Jesse-Custer", "John-Constantine", "Jonah-Hex", "Judge-Dredd", "Ka-Zar", 
        "Kitty-Pryde", "Luke-Cage", "Martian-Manhunter", "Marv", "Michonne", "Mitchell-Hundred", "Moon-Knight", "Nick-Fury", 
        "Nightcrawler", "Nova", "Professor-X", "Punisher", "Raphael", "Reed-Richards", "Renee-Montoya", "Rick-Grimes", 
        "Rorschach", "Savage-Dragon", "Scott-Pilgrim", "Sgt-Rock", "She-Hulk", "Silver-Surfer", "Spawn", "Spider-Man", 
        "Spider-Jerusalem", "Storm", "Sub-Mariner", "Superboy", "Supergirl", "Superman", "Swamp-Thing", "The-Atom", "The-Crow", 
        "The-Falcon", "The-Flash", "The-Hulk", "The-Rocketeer", "The-Spectre", "The-Spirit", "The-Thing", "The-Tick", "Thor", 
        "Robin", "Usagi-Yojimbo", "Wasp", "Wildcat", "Wolverine", "Wonder-Woman", "Yorick-Brown"
    ];
    
    function randomInt(min,max) {
        return Math.floor(Math.random()*(max-min+1)+min);
    }
    
    function randomSuperhero() {
        return superheroes[ randomInt(0, superheroes.length-1) ];
    }
    
    var Service = {
        randomInt: randomInt,
        randomSuperhero: randomSuperhero
    };     
    return Service;
});

})();