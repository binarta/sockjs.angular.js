angular.module('binarta.sockjs', ['config'])
    .provider('sockJS', SockJSProvider);

function SockJSProvider() {
    return {
        $get: ['config', '$q', '$window', SockJSFactory]
    }
}

function SockJSFactory(config, $q, $window) {
    var sock;
    var opened = false;
    var isSocketOpenedDeferred = $q.defer();
    var version = 0;

    var responsesHolder = {};

    function deferralForTopic(args) {
        var request = responsesHolder[args.topic];
        return request ? request.deferral : {resolve:function(){}}
    }

    function reset() {
        isSocketOpenedDeferred = $q.defer();
    }

    var init = function() {
        version++;
        sock = SockJS(config.socketUri, {}, {debug:true});
        $window.onbeforeunload = function() {
            sock.onclose = undefined;
            sock.close();
        };

        sock.onopen = function() {
            Object.keys(responsesHolder).forEach(function(key){
                var response = responsesHolder[key];
                if (response.version < version) sock.send(JSON.stringify(response.request));
            });
            opened = true;
            isSocketOpenedDeferred.resolve();
        };
        sock.onmessage = function(message) {
            var data = JSON.parse(message.data);
            deferralForTopic(data).resolve(data.payload);
            delete responsesHolder[data.topic];
        };
        sock.onclose = function() {
            if (opened) reset();
            opened = false;
            init();
        }
    };
    if (config.socketUri) init();
    return {
        send: function(data) {
            var deferral = $q.defer();
            responsesHolder[data.responseAddress] = {deferral: deferral, request: data, version: version};
            isSocketOpenedDeferred.promise.then(function() {
                sock.send(JSON.stringify(data));
            });
            return deferral.promise;
        }
    }
}