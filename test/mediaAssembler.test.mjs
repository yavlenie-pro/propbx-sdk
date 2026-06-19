import test from 'node:test';
import assert from 'node:assert/strict';
import { MediaAssembler } from '../dist/media/mediaAssembler.js';

function deterministic(n) {
    const b = Buffer.alloc(n);
    for (let i = 0; i < n; i++) b[i] = (i * 31 + 7) & 0xff;
    return b;
}

/** Split a buffer into MediaChunk frames the way the server does (eof on last data chunk). */
function chunkBuffer(buf, chunkSize, { mediaId, callId, info }) {
    const frames = [];
    const total = buf.length;
    if (total === 0) {
        return [{ media_id: mediaId, call_id: callId, seq: 0, eof: true, data: Buffer.alloc(0), info }];
    }
    let seq = 0;
    for (let off = 0; off < total; off += chunkSize) {
        const end = Math.min(off + chunkSize, total);
        const frame = { media_id: mediaId, call_id: callId, seq, eof: end >= total, data: buf.subarray(off, end) };
        if (seq === 0) frame.info = info;
        frames.push(frame);
        seq++;
    }
    return frames;
}

test('reassembles a single media byte-identical (200KB / 64KiB chunks)', () => {
    const src = deterministic(200000);
    const asm = new MediaAssembler();
    let got = null;
    asm.on('media', (m) => (got = m));
    const info = { kind: 'recording', format: 'wav', sample_rate: 8000, channels: 1, total_bytes: src.length, duration_ms: 12500 };
    for (const f of chunkBuffer(src, 65536, { mediaId: 'rec-1', callId: 'call-1', info })) asm.push(f);

    assert.ok(got, 'media event emitted');
    assert.equal(got.recordingID, 'rec-1');
    assert.equal(got.callID, 'call-1');
    assert.ok(got.buffer.equals(src), 'buffer is byte-identical');
    assert.equal(got.buffer.length, src.length);
    assert.equal(got.info.total_bytes, src.length);
    assert.equal(got.info.format, 'wav');
    assert.equal(got.info.sample_rate, 8000);
    assert.equal(asm.pendingCount(), 0, 'no pending media after eof');
});

test('handles a zero-length eof terminator (no prealloc path)', () => {
    const src = Buffer.from('hello world wav bytes');
    const asm = new MediaAssembler();
    let got = null;
    asm.on('media', (m) => (got = m));
    asm.push({ media_id: 'r', call_id: 'c', seq: 0, eof: false, data: src, info: { total_bytes: 0, format: 'wav' } });
    asm.push({ media_id: 'r', call_id: 'c', seq: 1, eof: true, data: Buffer.alloc(0) });
    assert.ok(got);
    assert.ok(got.buffer.equals(src));
});

test('demultiplexes interleaved media by media_id', () => {
    const a = Buffer.from('aaaaAAAA');
    const b = Buffer.from('bbbbbBBBBB');
    const asm = new MediaAssembler();
    const out = {};
    asm.on('media', (m) => (out[m.recordingID] = m.buffer));
    asm.push({ media_id: 'A', call_id: 'c', seq: 0, eof: false, data: a.subarray(0, 4), info: { total_bytes: a.length } });
    asm.push({ media_id: 'B', call_id: 'c', seq: 0, eof: false, data: b.subarray(0, 5), info: { total_bytes: b.length } });
    asm.push({ media_id: 'A', call_id: 'c', seq: 1, eof: true, data: a.subarray(4) });
    asm.push({ media_id: 'B', call_id: 'c', seq: 1, eof: true, data: b.subarray(5) });
    assert.ok(out.A.equals(a));
    assert.ok(out.B.equals(b));
});

test('flags a seq gap as mediaError and emits no media', () => {
    const asm = new MediaAssembler();
    let err = null;
    let media = false;
    asm.on('media', () => (media = true));
    asm.on('mediaError', (e) => (err = e));
    asm.push({ media_id: 'r', call_id: 'c', seq: 0, eof: false, data: Buffer.from('x'), info: { total_bytes: 3 } });
    asm.push({ media_id: 'r', call_id: 'c', seq: 2, eof: true, data: Buffer.from('z') }); // expected seq 1
    assert.ok(err, 'mediaError emitted');
    assert.equal(err.recordingID, 'r');
    assert.equal(media, false);
});

test('flags a missing seq 0 (first chunk seq != 0) as mediaError', () => {
    const asm = new MediaAssembler();
    let err = null;
    asm.on('mediaError', (e) => (err = e));
    asm.push({ media_id: 'r', call_id: 'c', seq: 1, eof: true, data: Buffer.from('z') });
    assert.ok(err);
    assert.match(err.error.message, /expected 0/);
});
