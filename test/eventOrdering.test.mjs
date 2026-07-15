import test from 'node:test';
import assert from 'node:assert/strict';
import { GrpcTransport } from '../dist/transport/grpcClient.js';

// Regression for the lost-callFinished bug: the server sends
// `callFinished` (a recording event, held by the correlator until its
// MediaStream bytes arrive) immediately followed by `call-disconnected`
// (not held). Without ordering, `call-disconnected` overtook the held
// `callFinished`, the class layer removed the call, and the late
// `callFinished` was dropped as belonging to a finished call — losing the
// call's duration and recording. The transport must now deliver them in the
// server's order regardless of the correlation hold.

function newTransport(recordingTimeoutMs) {
    // No network: onEvent is exercised directly; the channel is never opened.
    return new GrpcTransport({ url: 'localhost:1', appId: 'app', key: 'k', recordingTimeoutMs });
}

// A callFinished event whose recording bytes never arrive, so the correlator
// holds it for the full recordingTimeoutMs before emitting metadata-only.
function callFinishedEv(callId, recId = 'r1') {
    return { type: 'callFinished', call_id: callId, params: { recordings: [{ recordingID: recId }], duration: 42 } };
}
function callDisconnectedEv(callId) {
    return { type: 'call-disconnected', call_id: callId, params: { reason: 'caller_hangup' } };
}

test('call-disconnected waits behind a held callFinished (server order preserved)', async () => {
    const t = newTransport(60);
    const seen = [];
    t.on('message', (m) => seen.push(m.event));

    // callFinished arrives first and is held (no bytes); call-disconnected next.
    t.onEvent(callFinishedEv('c1'));
    t.onEvent(callDisconnectedEv('c1'));

    // Right away: nothing delivered yet — callFinished is still held.
    assert.deepEqual(seen, []);

    await new Promise((r) => setTimeout(r, 150));

    assert.deepEqual(
        seen,
        ['callFinished', 'call-disconnected'],
        'callFinished must be delivered before call-disconnected',
    );
});

test('call-disconnected is not delayed when no callFinished is pending', async () => {
    const t = newTransport(5000);
    const seen = [];
    t.on('message', (m) => seen.push(m.event));

    t.onEvent(callDisconnectedEv('c2'));

    // Delivered synchronously — not gated on any recording hold.
    assert.deepEqual(seen, ['call-disconnected']);
});

test('a held callFinished does not gate a different call', async () => {
    const t = newTransport(200);
    const seen = [];
    t.on('message', (m) => seen.push(`${m.event}:${m.callID}`));

    t.onEvent(callFinishedEv('c1'));         // held
    t.onEvent(callDisconnectedEv('c2'));     // unrelated call — must pass immediately

    assert.deepEqual(seen, ['call-disconnected:c2']);
});
