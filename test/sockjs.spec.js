describe('connection handler spec', function () {
    var $scope, adapter, client, now, maxReconnectionAttempts, resetRetriesTimeout, timedout, journal;

    beforeEach(inject(function ($q, $rootScope) {
        $scope = $rootScope;
        now = 0;
        maxReconnectionAttempts = 4;
        resetRetriesTimeout = 300;
        client = new DummyConnection();
        journal = new DummyJournal();
        adapter = new ConnectionLifecycleAdapter({
            client: client,
            maxReconnectionAttempts: maxReconnectionAttempts,
            resetRetriesTimeout: resetRetriesTimeout,
            journaler: journal.journaler
        });
        adapter.$q = $q;
        adapter.ontimeout = function () {
            timedout = true;
        };
        adapter.timestampingReconnectionHandler = function () {
            adapter.reconnectionHandler(now * 1000)
        };
    }));

    it('starts out disconnected', function () {
        expect(adapter.isDisconnected()).toEqual(true);
    });

    describe('when connected', function () {
        beforeEach(function () {
            adapter.internalConnect(now);
            client.open();
        });

        it('shutdown', function () {
            adapter.shutdown();
            expect(adapter.isDisconnected()).toEqual(true);
            expect(client.connected).toEqual(false);
        });

        it('expose connection status', function () {
            expect(adapter.isDisconnected()).toEqual(false);
            expect(adapter.isConnected()).toEqual(true);
        });

        it('connection status on mock', function () {
            expect(client.connected).toEqual(true);
            expect(client.timesConnected).toEqual(1);
        });

        it('closing connection reconnects', function () {
            client.close();
            client.open();
            expect(client.timesConnected).toEqual(2);
            expect(adapter.isConnected()).toEqual(true);

            client.close();
            client.open();
            expect(client.timesConnected).toEqual(3);
            expect(adapter.isConnected()).toEqual(true);
        });

        it('reconnect on close attempts are limited', function () {
            client.close();
            client.open();
            client.close();
            client.open();
            client.close();
            client.open();
            client.close();
            expect(client.timesConnected).toEqual(4);
            expect(adapter.isDisconnected()).toEqual(true);
        });

        it('test', function () {
            client.close();
            client.open();
            client.close();
            client.open();
            client.close();
            client.open();
            client.close();
            expect(timedout).toEqual(true);
        });

        it('connection errors reconnect', function () {
            client.error();
            client.open();
            expect(client.timesConnected).toEqual(2);
            expect(adapter.isConnected()).toEqual(true);

            client.error();
            client.open();
            expect(client.timesConnected).toEqual(3);
            expect(adapter.isConnected()).toEqual(true);
        });

        it('reconnect on error attempts are limited', function () {
            client.error();
            client.open();
            client.error();
            client.open();
            client.error();
            client.open();
            client.error();
            expect(client.timesConnected).toEqual(4);
            expect(adapter.isDisconnected()).toEqual(true);
        });

        it('reset retry limit when timeout reached', function () {
            client.close();
            client.open();
            client.close();
            client.open();
            client.close();
            client.open();

            now = resetRetriesTimeout;
            client.close();
            client.open();

            expect(client.timesConnected).toEqual(5);
            expect(adapter.isConnected()).toEqual(true);
        });
    });

    describe('when message is sent before socket is open', function () {
        var capturedResponses = [];

        beforeEach(function () {
            adapter.internalConnect(now);
            adapter.send({
                payload: {responseAddress: 'R', data: 'D'},
                onMessage: function (it) {
                    capturedResponses.push(it);
                }
            });
        });

        it('then no data was sent', function () {
            expect(client.capturedMessages).toEqual([]);
        });

        describe('and the socket is opened', function () {
            beforeEach(function () {
                adapter.internalConnect(now);
                client.open();
            });

            it('connection is journaled', function () {
                expect(journal.events[0]).toEqual({
                    from: 'ui.client.sockjs',
                    payload: {
                        mode: 'default',
                        numberOfConnectionAttempts: 2
                    }
                });
            });

            it('then the data is sent upon opening', function () {
                expect(client.capturedMessages[0]).toEqual(JSON.stringify({responseAddress: 'R', data: 'D'}));
            });

            it('data is only sent once', function () {
                expect(client.capturedMessages[1]).toBeUndefined();
            });

            it('send while open connection', function () {
                adapter.send({
                    payload: {responseAddress: 'O', data: 'D'},
                    onMessage: function (it) {
                        capturedResponses.push(it);
                    }
                });
                $scope.$digest();
                expect(client.capturedMessages[1]).toEqual(JSON.stringify({responseAddress: 'O', data: 'D'}));
            });

            describe('and the socket is closed before receiving a response', function () {
                beforeEach(function () {
                    client.close();
                });

                describe('and it is opened again', function () {
                    beforeEach(function () {
                        client.open();
                    });

                    it('the data was sent again', function () {
                        expect(client.capturedMessages[1]).toEqual(JSON.stringify({responseAddress: 'R', data: 'D'}));
                    });
                });
            });

            describe('and an answer is received', function () {
                beforeEach(function () {
                    client.respondWith({payload: JSON.stringify({topic: 'R', payload: 'P'})});
                    $scope.$digest();
                });

                it('then the response promise was resolved', function () {
                    expect(capturedResponses[0]).toEqual('P');
                    $scope.$digest();
                    expect(capturedResponses[1]).toBeUndefined();
                });

                describe('and answer is received again', function () {
                    beforeEach(function () {
                        capturedResponses = [];
                        client.respondWith({payload: JSON.stringify({topic: 'R', payload: 'P'})});
                        $scope.$digest();
                    });

                    it('then promise is not resolved again', function () {
                        expect(capturedResponses[0]).toBeUndefined();
                    })
                });

                describe('and we send another message', function () {
                    beforeEach(function () {
                        adapter.send({
                            payload: {responseAddress: 'RR', data: 'D'},
                            onMessage: function (it) {
                                capturedResponses.push(it);
                            }
                        });
                    });

                    describe('but socket was closed', function () {
                        beforeEach(function () {
                            client.close();
                        });

                        describe('but we still receive a response somehow', function () {
                            beforeEach(function () {
                                client.respondWith({payload: JSON.stringify({topic: 'RR', payload: 'PP'})});
                                $scope.$digest();
                            });

                            it('test', function () {
                                expect(capturedResponses[1]).toEqual('PP');
                            })
                        });
                    });
                });

                describe('and the socket was closed again', function () {
                    beforeEach(function () {
                        client.close();
                    });

                    describe('and data was sent while being closed', function () {
                        beforeEach(function () {
                            client.capturedMessages = [];
                            adapter.send({
                                payload: {responseAddress: 'RR', data: 'D'},
                                onMessage: function (it) {
                                    capturedResponses.push(it);
                                }
                            });
                        });

                        describe('and we failed to re initialize the socket', function () {
                            beforeEach(function () {
                                client.close();
                            });

                            it('no data was sent', function () {
                                expect(client.capturedMessages).toEqual([]);
                            });

                            describe('and the socket is open again', function () {
                                beforeEach(function () {
                                    client.open();
                                });

                                it('test', function () {
                                    expect(adapter.isConnected()).toEqual(true);
                                    expect(client.capturedMessages[0]).toEqual(JSON.stringify({
                                        responseAddress: 'RR',
                                        data: 'D'
                                    }));
                                })
                            });
                        });
                    });
                });
            });
        });
    })
});

function DummyConnection() {
    this.timesConnected = 0;
    this.capturedMessages = [];

    this.connect = function (app) {
        this.app = app;
        this.connected = true;
        this.timesConnected++;
    };

    this.open = function () {
        this.app.opened();
    };

    this.close = function () {
        var app = this.app;
        this.app = undefined;
        this.connected = false;
        app.closed();
    };

    this.error = function () {
        var app = this.app;
        this.app = undefined;
        this.connected = false;
        app.error();
    };

    this.send = function (args) {
        this.capturedMessages.push(args);
    };

    this.respondWith = function (args) {
        this.app.onMessage(args.payload);
    };

    this.disconnect = function () {
        this.close();
    };
}

function DummyJournal() {
    var self = this;

    this.events = [];

    this.journaler = function (evt) {
        self.events.push(evt);
    }
}
