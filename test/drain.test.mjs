import test from 'node:test';
import assert from 'node:assert/strict';
import propbxModule from '../dist/propbx.js';

const ProPBX = propbxModule.default ?? propbxModule;

// drain() takes this instance out of the server's call carousel before a
// restart: new calls go to the other instances of the app, calls already here
// keep working. The server keeps the flag per Session, so after a reconnect
// the SDK must send drain again.

function newPbx() {
    const pbx = new ProPBX({ url: 'localhost:1', appId: 'app', key: 'k' });
    const sent = [];
    pbx.transport = { sendAction: (data) => sent.push(data), stop() {} };
    return { pbx, sent };
}

function ev(event, callID = '', params = {}) {
    return { event, callID, params };
}

test('drain() sends a connection-level drain and resolves on drain-ok', async () => {
    const { pbx, sent } = newPbx();
    try {
        const seen = [];
        pbx.on('drain-ok', (call, params) => seen.push([call, params]));
        const done = pbx.drain(1000);
        assert.deepEqual(sent, [{ action: 'drain' }], 'no callID: the action is for the connection');
        assert.equal(pbx.isDraining(), true);

        pbx.handleWsMessage(ev('drain-ok', '', { draining: true }));
        await done;
        assert.deepEqual(seen, [[null, { draining: true }]], 'drain-ok is surfaced on the instance');
        assert.equal(pbx.getCallsCount(), 0, 'drain-ok never creates a call');
    } finally {
        pbx.stop();
    }
});

test('drain() rejects when the server does not answer, the intent stays', async () => {
    const { pbx } = newPbx();
    try {
        await assert.rejects(pbx.drain(20), /drain not acknowledged after 20ms/);
        assert.equal(pbx.isDraining(), true);
    } finally {
        pbx.stop();
    }
});

test('drain is re-sent after a reconnect, and the pending drain() resolves on its ack', async () => {
    const { pbx, sent } = newPbx();
    try {
        const done = pbx.drain(1000);
        // The Session dropped before the ack; the transport reconnects and the
        // new Session's Welcome arrives as auth-ok.
        pbx.onReconnect();
        pbx.handleWsMessage(ev('auth-ok'));
        assert.deepEqual(sent, [{ action: 'drain' }, { action: 'drain' }]);

        pbx.handleWsMessage(ev('drain-ok', '', { draining: true }));
        await done;
    } finally {
        pbx.stop();
    }
});

test('no drain on connect unless drain() was called, none after undrain()', async () => {
    const { pbx, sent } = newPbx();
    try {
        pbx.handleWsMessage(ev('auth-ok'));
        assert.deepEqual(sent, []);

        const drained = pbx.drain(1000);
        pbx.handleWsMessage(ev('drain-ok', '', { draining: true }));
        await drained;

        const undrained = pbx.undrain(1000);
        assert.deepEqual(sent.at(-1), { action: 'undrain' });
        assert.equal(pbx.isDraining(), false);
        pbx.handleWsMessage(ev('undrain-ok', '', { draining: false }));
        await undrained;

        sent.length = 0;
        pbx.handleWsMessage(ev('auth-ok'));
        assert.deepEqual(sent, []);
    } finally {
        pbx.stop();
    }
});

test('a pending undrain() is done by a reconnect: the new Session starts in the carousel', async () => {
    const { pbx } = newPbx();
    try {
        const undrained = pbx.undrain(1000);
        pbx.onReconnect();
        pbx.handleWsMessage(ev('auth-ok'));
        await undrained;
    } finally {
        pbx.stop();
    }
});

test('stop() rejects a pending drain()', async () => {
    const { pbx } = newPbx();
    const done = pbx.drain(1000);
    pbx.stop();
    await assert.rejects(done, /drain aborted: SDK stopped/);
});

test('calls keep being tracked while draining', async () => {
    const { pbx } = newPbx();
    try {
        pbx.handleWsMessage(ev('incomingCall', 'c1'));
        const done = pbx.drain(1000);
        pbx.handleWsMessage(ev('drain-ok', '', { draining: true }));
        await done;
        pbx.handleWsMessage(ev('transcribe', 'c1', { text: 'алло' }));
        assert.equal(pbx.getCallsCount(), 1);

        pbx.handleWsMessage(ev('callFinished', 'c1'));
        assert.equal(pbx.getCallsCount(), 0);
    } finally {
        pbx.stop();
    }
});
