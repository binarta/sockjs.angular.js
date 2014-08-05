var _sock;

describe('sockjs.js', function() {
    var config;
    var sut;
    var topicMessageDispatcherMock;

    beforeEach(module('config'));
    beforeEach(module('notifications'));
    beforeEach(module('binarta.sockjs'));

    beforeEach(inject(function(_config_, _topicMessageDispatcherMock_) {
        config = _config_;
        topicMessageDispatcherMock = _topicMessageDispatcherMock_;
    }));

    describe('sockJS', function() {
       beforeEach(inject(function(topicMessageDispatcher) {
           config.socketUri = 'http://localhost:8888/';
           sut = SockJSFactory(config, topicMessageDispatcher);
       }));

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
        })
    });

});

function SockJS(url) {
    _sock = {url:url, send: function(data) {_sock.data = data}};
    return _sock;
}

