import test from 'node:test';
import assert from 'node:assert/strict';
import propbxModule from '../dist/propbx.js';

const ProPBX = propbxModule.default ?? propbxModule;

// Regression for the phantom call that broke graceful shutdown: the server
// broadcasts `ping` to every connection (gRPC included) every
// websocket.ping_interval_sec with an empty call_id, and acks our PONG with a
// callID-less `wsPong`. Both were routed into the per-call dispatcher, which
// created a call with id '' and touched it on every ping — so getCallsCount()
// never reached 0 and drain-before-exit loops spun until SIGKILL. Events with
// no callID belong to the connection and must never create or track a call.

function newPbx(config = {}) {
    // No network: events are injected straight into the class layer via
    // handleWsMessage; a fake transport records outgoing actions.
    const pbx = new ProPBX({ url: 'localhost:1', appId: 'app', key: 'k', ...config });
    const sent = [];
    pbx.transport = { sendAction: (data) => sent.push(data), stop() {} };
    return { pbx, sent };
}

// The gRPC transport decodes an absent call_id as '' (proto-loader defaults).
function ev(event, callID = '', params = {}) {
    return { event, callID, params };
}

test('ping without a callID never creates a call', () => {
    const { pbx } = newPbx();
    try {
        for (let i = 0; i < 5; i++) {
            pbx.handleWsMessage(ev('ping'));
            pbx.handleWsMessage(ev('ping', undefined));
        }
        assert.equal(pbx.getCallsCount(), 0);
        assert.equal(pbx.getCall(''), undefined);
    } finally {
        pbx.stop();
    }
});

test('wsPong without a callID never creates a call', () => {
    const { pbx } = newPbx({ pingEnable: true });
    try {
        const seen = [];
        pbx.on('wsPong', () => seen.push('wsPong'));
        pbx.handleWsMessage(ev('wsPong'));
        assert.equal(pbx.getCallsCount(), 0);
        assert.deepEqual(seen, ['wsPong'], 'wsPong is still surfaced on the instance');
    } finally {
        pbx.stop();
    }
});

test('ping is answered with a callID-less PONG only when pingEnable is set', () => {
    const on = newPbx({ pingEnable: true });
    const off = newPbx();
    try {
        on.pbx.handleWsMessage(ev('ping'));
        assert.equal(on.sent.length, 1);
        assert.equal(on.sent[0].action, 'PONG');
        assert.ok(!on.sent[0].callID, 'PONG is connection-level, no callID');

        off.pbx.handleWsMessage(ev('ping'));
        assert.deepEqual(off.sent, []);
    } finally {
        on.pbx.stop();
        off.pbx.stop();
    }
});

test('pings during a real call do not keep the count above 0 after it ends', () => {
    const { pbx } = newPbx({ pingEnable: true });
    try {
        pbx.handleWsMessage(ev('incomingCall', 'c1'));
        pbx.handleWsMessage(ev('ping'));
        pbx.handleWsMessage(ev('wsPong'));
        assert.equal(pbx.getCallsCount(), 1);

        pbx.handleWsMessage(ev('callFinished', 'c1'));
        pbx.handleWsMessage(ev('ping'));
        assert.equal(pbx.getCallsCount(), 0, 'a drain loop on getCallsCount() must be able to finish');
    } finally {
        pbx.stop();
    }
});
