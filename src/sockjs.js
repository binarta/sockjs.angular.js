angular.module('binarta.sockjs', [])
    .factory('sockJS', ['config', 'topicMessageDispatcher', SockJSFactory]);

function SockJSFactory(config, topicMessageDispatcher) {
    var sock = undefined;

    var init = function() {
        sock = SockJS(config.socketUri);

        sock.onopen = function() {
            topicMessageDispatcher.firePersistently('sockjs.loaded', 'ok');
        };
        sock.onmessage = function(message) {
            var data = JSON.parse(message.data);
            topicMessageDispatcher.fire(data.topic, data.payload);
        };
        sock.onclose = function() {
            init();
        }
    };

    if (config.socketUri) init();
    return {
        send: function(data) {
            sock.send(JSON.stringify(data));
        }
    }
}