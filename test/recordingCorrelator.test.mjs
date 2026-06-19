import test from 'node:test';
import assert from 'node:assert/strict';
import { RecordingCorrelator } from '../dist/media/recordingCorrelator.js';

function media(id, str, info = {}) {
    return { recordingID: id, callID: 'c', buffer: Buffer.from(str), info };
}
const b64 = (s) => Buffer.from(s).toString('base64');

test('bytes-before-event: recordingComplete entry is populated', async () => {
    const c = new RecordingCorrelator();
    c.addMedia(media('r1', 'audio-bytes', { format: 'wav', duration_ms: 1000 }));
    const msg = { event: 'recordingComplete', recordingID: 'r1', params: { recordingID: 'r1', format: 'wav', size: 11 } };
    const out = await c.correlate(msg, 'recordingComplete');
    assert.equal(out.params.data, b64('audio-bytes'));
    assert.equal(out.params.binaryData, b64('audio-bytes'));
    assert.ok(Buffer.isBuffer(out.params.buffer));
    assert.ok(out.params.buffer.equals(Buffer.from('audio-bytes')));
    c.dispose();
});

test('event-before-bytes: event is held until media arrives', async () => {
    const c = new RecordingCorrelator({ recordingTimeoutMs: 1000 });
    const msg = { event: 'recordingComplete', recordingID: 'r2', params: { recordingID: 'r2' } };
    const p = c.correlate(msg, 'recordingComplete');
    setTimeout(() => c.addMedia(media('r2', 'late-bytes')), 20);
    const out = await p;
    assert.equal(out.params.data, b64('late-bytes'));
    c.dispose();
});

test('callFinished: fills every recording (mixed timing)', async () => {
    const c = new RecordingCorrelator({ recordingTimeoutMs: 1000 });
    c.addMedia(media('a', 'AAA'));
    const msg = {
        event: 'callFinished',
        callID: 'c',
        params: { recordings: [{ recordingID: 'a' }, { recordingID: 'b' }], duration: 5 },
    };
    const p = c.correlate(msg, 'callFinished');
    setTimeout(() => c.addMedia(media('b', 'BBBB')), 15);
    const out = await p;
    assert.equal(out.params.recordings[0].data, b64('AAA'));
    assert.equal(out.params.recordings[1].data, b64('BBBB'));
    assert.equal(out.params.duration, 5, 'surrounding params preserved');
    c.dispose();
});

test('timeout: emits metadata-only when bytes never arrive', async () => {
    const c = new RecordingCorrelator({ recordingTimeoutMs: 40 });
    const msg = { event: 'recordingComplete', recordingID: 'x', params: { recordingID: 'x', size: 99 } };
    const out = await c.correlate(msg, 'recordingComplete');
    assert.equal(out.params.data, undefined, 'no audio injected');
    assert.equal(out.params.size, 99, 'metadata preserved');
    c.dispose();
});

test('same recordingID feeds both recordingComplete and a later callFinished', async () => {
    const c = new RecordingCorrelator({ recordingTimeoutMs: 1000 });
    c.addMedia(media('r', 'SHARED'));
    const rc = await c.correlate(
        { event: 'recordingComplete', recordingID: 'r', params: { recordingID: 'r' } },
        'recordingComplete',
    );
    assert.equal(rc.params.data, b64('SHARED'));
    // callFinished referencing the same id still gets the audio (bytes not consumed on inject).
    const cf = await c.correlate(
        { event: 'callFinished', callID: 'c', params: { recordings: [{ recordingID: 'r' }] } },
        'callFinished',
    );
    assert.equal(cf.params.recordings[0].data, b64('SHARED'));
    c.dispose();
});

test('non-recording messages pass through untouched', async () => {
    const c = new RecordingCorrelator();
    const msg = { event: 'transcribe', params: { transcript: 'hi' } };
    const out = await c.correlate(msg, 'transcribe');
    assert.equal(out, msg);
    c.dispose();
});
