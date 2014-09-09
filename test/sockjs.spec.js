var _sock;

describe('sockjs.js', function() {
    var config;
    var sut;
    var topicMessageDispatcherMock;
    var topicRegistryMock;
    var $rootScope;

    beforeEach(module('config'));
    beforeEach(module('notifications'));
    beforeEach(module('binarta.sockjs'));

    beforeEach(inject(function(_config_, _topicMessageDispatcherMock_, _topicRegistryMock_, _$rootScope_) {
        config = {};
        topicMessageDispatcherMock = _topicMessageDispatcherMock_;
        topicRegistryMock = _topicRegistryMock_;
        $rootScope = _$rootScope_;
    }));

    describe('sockJS', function() {
       beforeEach(inject(function(topicMessageDispatcher, $q) {
           config.socketUri = 'http://localhost:8888/';
           sut = SockJSProvider().$get(config, $q)
       }));

        it('socket uri is passed', function() {
            expect(_sock.url).toEqual(config.socketUri);
        });

        describe('when message is sent before socket is open', function() {
            var promise;

            beforeEach(function() {
                promise = sut.send({responseAddress:'R', data:'D'});
            });

            it('then no data was sent across the socket', function() {
                expect(_sock.data).toBeUndefined();
            });

            describe('and the socket is opened', function() {
                beforeEach(function() {
                    _sock.onopen();
                    $rootScope.$digest();
                });

                it('then the data is sent upon opening', function() {
                    expect(_sock.data).toEqual(JSON.stringify({responseAddress:'R', data:'D'}));
                });

                describe('and an answer is received', function() {
                    beforeEach(function() {
                        _sock.onmessage({data:JSON.stringify({topic:'R', payload:'P'})});
                    });

                    it('then the response promise was resolved', function() {
                        expect(getExecutedHandlerFor(promise)).toHaveBeenCalledWith('P')
                    })
                });

                describe('and we send another message', function() {
                    beforeEach(function() {
                        promise = sut.send({responseAddress:'RR', data:'D'});
                    });

                    describe('but socket was closed', function() {
                        beforeEach(function() {
                            _sock.onclose();
                        });

                        describe('but we still receive a response somehow', function() {
                            beforeEach(function() {
                                _sock.onmessage({data:JSON.stringify({topic:'RR', payload:'P'})});
                            });

                            it('test', function() {
                                expect(getExecutedHandlerFor(promise)).not.toHaveBeenCalled();
                            })
                        });
                    });
                });

                describe('and the socket was closed again', function() {
                    beforeEach(function() {
                        _sock.onclose();
                    });

                    describe('and data was sent while being closed', function() {
                        beforeEach(function() {
                            promise = sut.send({responseAddress:'RR', data:'D'});
                        });

                        describe('and we failed to re initialize the socket', function() {
                            beforeEach(function() {
                                _sock.onclose();
                            });

                            it('no data was sent', function() {
                                $rootScope.$digest();
                                expect(_sock.data).toBeUndefined();
                            });

                            describe('and the socket is open again', function() {
                                beforeEach(function() {
                                    _sock.onopen();
                                    $rootScope.$apply();
                                });

                                it('test', function() {
                                    expect(_sock.data).toEqual(JSON.stringify({responseAddress:'RR', data:'D'}));
                                })
                            });
                        });
                    });
                });
            });
        });

        function getExecutedHandlerFor(promise) {
            var handler = jasmine.createSpy('handler');
            promise.then(handler);
            $rootScope.$digest();
            return handler;
        }

        describe('without socket uri', function() {
            beforeEach(inject(function(topicMessageDispatcher) {
                _sock = undefined;
                sut = SockJSProvider({}, topicMessageDispatcher)
            }));

            it('test', function() {
                expect(_sock).toBeUndefined();
            })
        });
    });

});

function SockJS(url, ignored, args) {
    _sock = {url:url, send: function(data) {_sock.data = data}, args: args};
    return _sock;
}

