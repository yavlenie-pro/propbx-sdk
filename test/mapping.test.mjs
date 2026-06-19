import test from 'node:test';
import assert from 'node:assert/strict';
import { toActionFrame, toClientMessage } from '../dist/transport/mapping.js';
import { sanitizeForStruct } from '../dist/transport/struct.js';

// ---- send: v1 action object -> gRPC Action ----

test('toActionFrame: simple action hoists callID to call_id', () => {
    const f = toActionFrame({ action: 'answer', callID: 'call-1' });
    assert.equal(f.type, 'answer');
    assert.equal(f.call_id, 'call-1');
    assert.deepEqual(f.params, {});
});

test('toActionFrame: tts keeps nested params, strips action/callID and undefined', () => {
    const f = toActionFrame({ action: 'tts', callID: 'c1', params: { text: 'hi', playbackID: 'p1', ssml: undefined } });
    assert.equal(f.type, 'tts');
    assert.equal(f.call_id, 'c1');
    assert.deepEqual(f.params, { params: { text: 'hi', playbackID: 'p1' } });
});

test('toActionFrame: make-call keeps top-level `to` and nested params; no top-level callID', () => {
    const f = toActionFrame({ action: 'make-call', to: '123', params: { number: '123', appID: 'app', callID: 'mc1' } });
    assert.equal(f.type, 'make-call');
    assert.equal(f.call_id, '');
    assert.deepEqual(f.params, { to: '123', params: { number: '123', appID: 'app', callID: 'mc1' } });
});

test('toActionFrame: send-sms folds all top-level fields into params', () => {
    const f = toActionFrame({
        action: 'send-sms',
        to: '79991234567',
        text: 'hi',
        from: 'X',
        digital: 1,
        short: 0,
        id: 's1',
        callID: 'call-9',
    });
    assert.equal(f.type, 'send-sms');
    assert.equal(f.call_id, 'call-9');
    assert.deepEqual(f.params, { to: '79991234567', text: 'hi', from: 'X', digital: 1, short: 0, id: 's1' });
});

test('toActionFrame: missing callID yields empty call_id', () => {
    const f = toActionFrame({ action: 'stop-app' });
    assert.equal(f.type, 'stop-app');
    assert.equal(f.call_id, '');
    assert.deepEqual(f.params, {});
});

// ---- receive: gRPC Event -> v1 message ----

test('toClientMessage: hoists sessionID, keeps params intact', () => {
    const m = toClientMessage({ type: 'transcribe', call_id: 'c1', params: { sessionID: 's1', transcript: 'hello', eou: true } });
    assert.equal(m.event, 'transcribe');
    assert.equal(m.callID, 'c1');
    assert.equal(m.sessionID, 's1');
    assert.equal(m.playbackID, undefined);
    assert.equal(m.recordingID, undefined);
    assert.deepEqual(m.params, { sessionID: 's1', transcript: 'hello', eou: true });
});

test('toClientMessage: hoists playbackID and recordingID', () => {
    assert.equal(toClientMessage({ type: 'playbackFinished', call_id: 'c', params: { playbackID: 'p1' } }).playbackID, 'p1');
    assert.equal(
        toClientMessage({ type: 'recordingComplete', call_id: 'c', params: { recordingID: 'r1' } }).recordingID,
        'r1',
    );
});

test('toClientMessage: missing params is tolerated', () => {
    const m = toClientMessage({ type: 'callNoAnswer', call_id: 'c' });
    assert.equal(m.event, 'callNoAnswer');
    assert.deepEqual(m.params, {});
});

test('toClientMessage: flattens a raw google.protobuf.Struct wrapper into plain params', () => {
    // The shape @grpc/proto-loader hands back for a Struct field. Without
    // flattening, call.params.message_id / caller_number land on the wrapper and
    // read as undefined ("reads in the wrong place").
    const m = toClientMessage({
        type: 'incomingCall',
        call_id: 'c1',
        params: {
            fields: {
                message_id: { kind: 'stringValue', stringValue: 'c1' },
                caller_number: { kind: 'stringValue', stringValue: '79991234567' },
                called_number: { kind: 'stringValue', stringValue: '74950000000' },
                direction: { kind: 'stringValue', stringValue: 'inbound' },
                headers: {
                    kind: 'structValue',
                    structValue: { fields: { 'X-foo': { kind: 'stringValue', stringValue: 'bar' } } },
                },
            },
        },
    });
    assert.equal(m.event, 'incomingCall');
    assert.equal(m.callID, 'c1');
    assert.deepEqual(m.params, {
        message_id: 'c1',
        caller_number: '79991234567',
        called_number: '74950000000',
        direction: 'inbound',
        headers: { 'X-foo': 'bar' },
    });
});

// ---- struct sanitization ----

test('sanitizeForStruct: strips undefined, keeps null, recurses', () => {
    assert.deepEqual(sanitizeForStruct({ a: 1, b: undefined, c: null, d: { e: undefined, f: 2 } }), {
        a: 1,
        c: null,
        d: { f: 2 },
    });
});

test('sanitizeForStruct: array holes become null', () => {
    assert.deepEqual(sanitizeForStruct([1, undefined, 3]), [1, null, 3]);
});

test('sanitizeForStruct: drops Buffers and non-finite numbers', () => {
    assert.deepEqual(sanitizeForStruct({ buf: Buffer.from('x'), n: NaN, ok: 'y' }), { n: null, ok: 'y' });
});
