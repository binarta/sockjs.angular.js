angular.module('binarta.sockjs', [])
    .provider('sockJS', SockJSProvider);

function SockJSProvider() {
    return {
        $get: SockJSFactory
    }
}

function SockJSFactory(config, $q) {
    var sock;
    var opened = false;
    var isSocketOpenedDeferred = $q.defer();

    var responseDeferrals = {};

    function deferralForTopic(args) {
        return responseDeferrals[args.topic] || {resolve:function() {}}
    }

    function reset() {
        isSocketOpenedDeferred = $q.defer();
        responseDeferrals = {};
    }

    var init = function() {
        sock = SockJS(config.socketUri, {}, {debug:true});

        sock.onopen = function() {
            opened = true;
            isSocketOpenedDeferred.resolve();
        };
        sock.onmessage = function(message) {
            var data = JSON.parse(message.data);
            deferralForTopic(data).resolve(data.payload);
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
            var deferredResponse = $q.defer();
            responseDeferrals[data.responseAddress] = deferredResponse;
            isSocketOpenedDeferred.promise.then(function() {
                sock.send(JSON.stringify(data));
            });
            return deferredResponse.promise;
        }
    }
}