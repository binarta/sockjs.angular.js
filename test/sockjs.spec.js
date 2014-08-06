var _sock;

describe('sockjs.js', function() {
    var config;
    var sut;
    var topicMessageDispatcherMock;
    var topicRegistryMock;

    beforeEach(module('config'));
    beforeEach(module('notifications'));
    beforeEach(module('binarta.sockjs'));

    beforeEach(inject(function(_config_, _topicMessageDispatcherMock_, _topicRegistryMock_) {
        config = _config_;
        topicMessageDispatcherMock = _topicMessageDispatcherMock_;
        topicRegistryMock = _topicRegistryMock_;
    }));

    describe('sockJS', function() {
       beforeEach(inject(function(topicMessageDispatcher, sockJS) {
           config.socketUri = 'http://localhost:8888/';
           sut = sockJS;
       }));

        describe('on config.initialized', function() {
            beforeEach(function() {
                topicRegistryMock['config.initialized'](config);
            });

            it('socket uri is passed', function() {
                expect(_sock.url).toEqual(config.socketUri);
            });

            it('on open fire sockjs.loaded', function() {
                _sock.onopen();
                expect(topicMessageDispatcherMock.persistent['sockjs.loaded']).toEqual('ok');
            });

            it('on message fire notification for response address', function() {
                _sock.onmessage({data: JSON.stringify({topic:'T', payload:'P'})});
                expect(topicMessageDispatcherMock['T']).toEqual('P');
            });

            it('send data over socket', function() {
                sut.send({payload:'P'});
                expect(_sock.data).toEqual(JSON.stringify({payload:'P'}));
            });

            it('on close re init socket', function() {
                var previous = _sock;
                _sock.onclose();
                expect(_sock).toNotEqual(previous);
            })
        });
    });

});

function SockJS(url) {
    _sock = {url:url, send: function(data) {_sock.data = data}};
    return _sock;
}

