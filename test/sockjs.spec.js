var _sock;

describe('sockjs.js', function() {
    var config;
    var sut;
    var $rootScope;

    beforeEach(module('config'));
    beforeEach(module('binarta.sockjs'));

    beforeEach(inject(function(_config_, _$rootScope_) {
        config = {};
        $rootScope = _$rootScope_;
    }));

    describe('sockJS', function() {
       beforeEach(inject(function($q, $window) {
           config.socketUri = 'http://localhost:8888/';
           sut = SockJSProvider().$get[3](config, $q, $window)
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
                expect(_sock.data).toEqual([]);
            });

            describe('and the socket is opened', function() {
                beforeEach(function() {
                    _sock.onopen();
                    $rootScope.$digest();
                });

                it('then the data is sent upon opening', function() {
                    expect(_sock.data[0]).toEqual(JSON.stringify({responseAddress:'R', data:'D'}));
                });

                it('data is only sent once', function() {
                    expect(_sock.data[1]).toBeUndefined();
                });

                describe('and the socket is closed before receiving a response', function() {
                    beforeEach(function() {
                        _sock.onclose();
                    });

                    describe('and it is opened again', function() {
                        beforeEach(function() {
                            _sock.onopen();
                            $rootScope.$digest();
                        });

                        it('the data was sent again', function() {
                            expect(_sock.data[0]).toEqual(JSON.stringify({responseAddress:'R', data:'D'}));
                        });
                    });
                });

                describe('and an answer is received', function() {
                    beforeEach(function() {
                        _sock.onmessage({data:JSON.stringify({topic:'R', payload:'P'})});
                    });

                    it('then the response promise was resolved', function() {
                        expect(getExecutedHandlerFor(promise)).toHaveBeenCalledWith('P');
                        expect(getExecutedHandlerFor(promise).callCount).toEqual(1);
                    });

                    describe('and answer is received again', function() {
                        beforeEach(function() {
                            _sock.onmessage({data:JSON.stringify({topic:'R', payload:'P'})});
                        });

                        it('then promise is not resolved again', function() {
                            expect(getExecutedHandlerFor(promise).callCount).toEqual(1);
                        })
                    });

                    describe('and page gets refreshed', function() {
                        beforeEach(inject(function($window) {
                            $window.onbeforeunload();
                        }));

                        it('onclose hook is disabled', function() {
                            expect(_sock.onclose).toBeUndefined();
                        });

                        it('test', function() {
                            expect(_sock.closed).toBeTruthy();
                        })
                    });
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
                                expect(getExecutedHandlerFor(promise)).toHaveBeenCalledWith('P');
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
                                expect(_sock.data).toEqual([]);
                            });

                            describe('and the socket is open again', function() {
                                beforeEach(function() {
                                    _sock.onopen();
                                    $rootScope.$apply();
                                });

                                it('test', function() {
                                    expect(_sock.data[1]).toEqual(JSON.stringify({responseAddress:'RR', data:'D'}));
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
            beforeEach(inject(function() {
                _sock = undefined;
                sut = SockJSProvider({})
            }));

            it('test', function() {
                expect(_sock).toBeUndefined();
            })
        });
    });
});

function SockJS(url, ignored, args) {
    _sock = {url:url, send: function(data) {_sock.data.push(data)}, args: args, close: function() {_sock.closed = true }};
    _sock.data = [];
    return _sock;
}

