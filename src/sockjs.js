angular.module('binarta.sockjs', ['config', 'notifications'])
    .factory('sockJsClientWrapper', ['config', function (config) {
        function SockJSClientWrapper() {
            var sock;

            this.connect = function (app) {
                sock = SockJS(config.socketUri, {}, {debug: true});
                sock.onopen = app.opened;
                sock.onmessage = function (it) {
                    app.onMessage(it.data);
                };
                sock.onclose = app.closed;
            };

            this.send = function (args) {
                sock.send(args)
            };

            this.disconnect = function () {
                sock.close();
            };
        }

        return new SockJSClientWrapper();
    }])
    .factory('connectionLifecycleAdapter', ['$q', '$timeout', 'sockJsClientWrapper', function ($q, $timeout, client) {
        var adapter = new ConnectionLifecycleAdapter({
            client: client,
            maxReconnectionAttempts: 3,
            resetRetriesTimeout: 60
        });
        adapter.$q = $q;
        adapter.timeout = function (cb, delay) {
            $timeout(cb, delay);
        };
        return adapter;
    }])
    .factory('sockJS', ['connectionLifecycleAdapter', '$q', function (client, $q) {
        return {
            send: function (data) {
                var deferral = $q.defer();
                client.send({
                    payload: data,
                    onMessage: deferral.resolve
                });
                return deferral.promise;
            }
        }

    }])
    .run(['connectionLifecycleAdapter', '$window', 'notificationPresenter', function (adapter, $window, notify) {
        adapter.ontimeout = function () {
            notify({
                type: 'warning',
                title: 'disconnected!',
                text: 'We could not establish a connection to the server. Refresh the page to try again.',
                persistent: true
            });
        };
        adapter.connect();
        $window.onbeforeunload = adapter.shutdown;
    }]);

function ConnectionLifecycleAdapter(args) {
    var self = this;
    var client = args.client;
    var connected = false;
    var connectionStartTime = -1;
    var delayBetweenReconnects = 500;
    var resetRetriesTimeout = args.resetRetriesTimeout;
    var maxReconnectionAttempts = args.maxReconnectionAttempts;
    var numberOfConnectionAttempts = 0;
    var responsesHolder = {};
    var shutdown = false;
    var isSocketOpenedDeferred;

    function reset() {
        isSocketOpenedDeferred = self.$q.defer();
    }

    this.timeout = function (cb, delay) {
        cb();
    };
    this.ontimeout = function () {
    };

    this.reconnectionHandler = function (now) {
        if (connected) reset();
        connected = false;
        if (shutdown) return;
        if (connectionStartTime != -1 && now - (resetRetriesTimeout * 1000) >= connectionStartTime) {
            delayBetweenReconnects = 500;
            numberOfConnectionAttempts = 0;
        }
        if (numberOfConnectionAttempts < maxReconnectionAttempts) {
            var delay = delayBetweenReconnects * (numberOfConnectionAttempts - 1);
            self.timeout(self.internalConnect, delay);
        } else self.ontimeout();
    };
    this.timestampingReconnectionHandler = function () {
        self.reconnectionHandler(new Date().getTime());
    };

    function deferralForTopic(args) {
        var request = responsesHolder[args.topic];
        return request ? request.deferral : {
            resolve: function () {
            }
        }
    }

    var reconnectOrTimeout = function () {
        self.timestampingReconnectionHandler();
    };
    var eventHandler = {
        opened: function () {
            connected = true;
            Object.keys(responsesHolder).forEach(function (key) {
                var response = responsesHolder[key];
                if (response.version < numberOfConnectionAttempts) client.send(JSON.stringify(response.request));
            });
            isSocketOpenedDeferred.resolve();
        },
        onMessage: function (message) {
            var data = JSON.parse(message);
            deferralForTopic(data).resolve(data.payload);
            delete responsesHolder[data.topic];
        },
        closed: reconnectOrTimeout,
        error: reconnectOrTimeout
    };

    this.isDisconnected = function () {
        return !connected;
    };

    this.isConnected = function () {
        return connected;
    };

    this.internalConnect = function (now) {
        if (now != undefined) {
            connectionStartTime = now;
            reset();
        }
        numberOfConnectionAttempts++;
        client.connect(eventHandler);
    };
    this.connect = function () {
        self.internalConnect(new Date().getTime());
    };

    this.send = function (args) {
        var deferral = this.$q.defer();
        responsesHolder[args.payload.responseAddress] = {
            deferral: deferral,
            request: args.payload,
            version: numberOfConnectionAttempts
        };
        deferral.promise.then(args.onMessage);
        isSocketOpenedDeferred.promise.then(function () {
            client.send(JSON.stringify(args.payload));
        });
    };

    this.shutdown = function () {
        shutdown = true;
        client.disconnect();
    }
}
