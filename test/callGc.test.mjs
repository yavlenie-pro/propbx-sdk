import test from 'node:test';
import assert from 'node:assert/strict';
import propbxModule from '../dist/propbx.js';

const ProPBX = propbxModule.default ?? propbxModule;

// Regression for the lost-end-of-call bug on long transfers: during an active
// bridge (call-forward -> operator conversation) the server emits no per-call
// events at all, so the class layer's inactivity GC (maxCallTimeout) removed
// the call object mid-bridge and tombstoned its callID in `finishedCalls`.
// Every later event — forwardedCallFinished, callFinished, call-disconnected —
// was then silently dropped: any transfer longer than maxCallTimeout lost its
// end-of-call events. Hardening is two-fold: bridged calls are exempt from the
// inactivity GC, and an inactivity expiry no longer tombstones the callID.

function newPbx(maxCallTimeout) {
    // No network: events are injected straight into the class layer via
    // handleWsMessage; the transport is never started.
    return new ProPBX({ url: 'localhost:1', appId: 'app', key: 'k' }, maxCallTimeout);
}

function ev(event, callID, params = {}) {
    return { event, callID, params };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('bridged call survives inactivity GC and delivers forwardedCallFinished', async () => {
    const pbx = newPbx(40);
    try {
        pbx.handleWsMessage(ev('forward-started', 'c1'));
        const call = pbx.getCall('c1');
        assert.ok(call, 'call must be tracked after forward-started');
        assert.equal(call.isBridged, true);

        // Several full GC periods of bridge silence — the call must survive.
        await sleep(150);
        assert.ok(pbx.getCall('c1'), 'bridged call must not be GC-ed by inactivity');

        const seen = [];
        pbx.on('forwardedCallFinished', (c) => seen.push(c.id));
        pbx.handleWsMessage(ev('forwardedCallFinished', 'c1', { duration: 300 }));
        assert.deepEqual(seen, ['c1']);
        assert.equal(pbx.getCall('c1').isBridged, false);

        // callFinished follows and removes the call for real.
        pbx.handleWsMessage(ev('callFinished', 'c1'));
        assert.equal(pbx.getCall('c1'), undefined);
        assert.ok(pbx.finishedCalls.has('c1'), 'callFinished must tombstone');
    } finally {
        pbx.stop();
    }
});

test('unbridged call is still GC-ed, but without a tombstone; late events get through', async () => {
    const pbx = newPbx(30);
    try {
        pbx.handleWsMessage(ev('dtmfReceived', 'c2'));
        assert.ok(pbx.getCall('c2'));

        await sleep(100);
        assert.equal(pbx.getCall('c2'), undefined, 'idle call must still be GC-ed');
        assert.equal(pbx.finishedCalls.has('c2'), false, 'inactivity expiry must not tombstone');

        // A late end-of-call event recreates the call and reaches instance listeners.
        const seen = [];
        pbx.on('forwardedCallFinished', (c, params) => seen.push([c.id, params.duration]));
        pbx.handleWsMessage(ev('forwardedCallFinished', 'c2', { duration: 42 }));
        assert.deepEqual(seen, [['c2', 42]]);
    } finally {
        pbx.stop();
    }
});

test('callFinished tombstone still drops late events', () => {
    const pbx = newPbx(60);
    try {
        pbx.handleWsMessage(ev('dtmfReceived', 'c3'));
        pbx.handleWsMessage(ev('callFinished', 'c3'));

        const seen = [];
        pbx.on('transcribe', (c) => seen.push(c.id));
        pbx.handleWsMessage(ev('transcribe', 'c3'));
        assert.deepEqual(seen, [], 'events after callFinished must stay dropped');
        assert.equal(pbx.getCall('c3'), undefined);
    } finally {
        pbx.stop();
    }
});

test('callKeepalive resets the inactivity timer and never creates a phantom call', async () => {
    const pbx = newPbx(60);
    try {
        // Keepalive for an unknown callID must not spawn a call object.
        pbx.handleWsMessage(ev('callKeepalive', 'ghost'));
        assert.equal(pbx.getCallsCount(), 0);

        pbx.handleWsMessage(ev('dtmfReceived', 'c4'));
        // Feed keepalives more often than maxCallTimeout for several periods.
        for (let i = 0; i < 8; i++) {
            await sleep(25);
            pbx.handleWsMessage(ev('callKeepalive', 'c4'));
        }
        assert.ok(pbx.getCall('c4'), 'keepalive must keep the call alive');

        // Keepalives stop -> the ordinary inactivity GC applies again.
        await sleep(150);
        assert.equal(pbx.getCall('c4'), undefined);
    } finally {
        pbx.stop();
    }
});
