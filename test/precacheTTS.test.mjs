import test from 'node:test';
import assert from 'node:assert/strict';
// dist is CommonJS; default-import then destructure (Node ESM interop).
import sdk from '../dist/index.js';
import actionsPkg from '../dist/actions.js';

const { ProPBXSDK } = sdk;
const { precacheTTS: precacheTTSAction } = actionsPkg;
const cfg = { url: 'localhost:9091', appId: 'a', key: 'k' };

// ---- action factory (pure) ----

test('precacheTTS action: cache-tts type, only defined opts, no callID', () => {
    const a = precacheTTSAction('привет', 'req-1', { voice: 'alena', language: 'ru-RU' });
    assert.equal(a.action, 'cache-tts');
    assert.equal(a.callID, undefined); // connection-level, no call
    assert.deepEqual(a.params, { text: 'привет', requestID: 'req-1', voice: 'alena', language: 'ru-RU' });
});

test('precacheTTS action: object voice is passed through verbatim', () => {
    const a = precacheTTSAction('hi', 'r', { voice: { id: 'alena', speed: 0.9, emotion: 'neutral' }, provider: 'yandex' });
    assert.deepEqual(a.params.voice, { id: 'alena', speed: 0.9, emotion: 'neutral' });
    assert.equal(a.params.provider, 'yandex');
});

// ---- ProPBX.precacheTTS lifecycle ----
// No start() => transport is undefined => send() is a no-op; we drive the
// dispatcher directly. TS `private` is erased at runtime, so .pendingPrecache
// and .handleWsMessage are reachable from this .mjs test.

test('resolves on cacheTTSReady { ok: true } matched by requestID', async () => {
    const bot = new ProPBXSDK(cfg);
    const p = bot.precacheTTS('привет', { voice: 'alena', timeoutMs: 5000 });
    const ids = [...bot.pendingPrecache.keys()];
    assert.equal(ids.length, 1);
    bot.handleWsMessage({ event: 'cacheTTSReady', params: { text: 'привет', voice: 'alena', ok: true, requestID: ids[0] } });
    await p;
    assert.equal(bot.pendingPrecache.size, 0, 'pending entry cleaned up');
    bot.stop();
});

test('rejects on cacheTTSReady { ok: false } with the server error', async () => {
    const bot = new ProPBXSDK(cfg);
    const p = bot.precacheTTS('x', { timeoutMs: 5000 });
    const requestID = [...bot.pendingPrecache.keys()][0];
    bot.handleWsMessage({ event: 'cacheTTSReady', params: { ok: false, error: 'provider down', requestID } });
    await assert.rejects(p, /provider down/);
    assert.equal(bot.pendingPrecache.size, 0);
    bot.stop();
});

test('rejects on timeout', async () => {
    const bot = new ProPBXSDK(cfg);
    await assert.rejects(bot.precacheTTS('x', { timeoutMs: 30 }), /timed out/);
    assert.equal(bot.pendingPrecache.size, 0);
    bot.stop();
});

test('rejects when text is missing', async () => {
    const bot = new ProPBXSDK(cfg);
    await assert.rejects(bot.precacheTTS(''), /text is required/);
    bot.stop();
});

test('stop() rejects all pending precache promises', async () => {
    const bot = new ProPBXSDK(cfg);
    const p1 = bot.precacheTTS('a', { timeoutMs: 5000 });
    const p2 = bot.precacheTTS('b', { timeoutMs: 5000 });
    assert.equal(bot.pendingPrecache.size, 2);
    bot.stop();
    await assert.rejects(p1, /SDK stopped/);
    await assert.rejects(p2, /SDK stopped/);
    assert.equal(bot.pendingPrecache.size, 0);
});

test('an unknown / missing requestID is ignored (no throw, no leak)', () => {
    const bot = new ProPBXSDK(cfg);
    bot.handleWsMessage({ event: 'cacheTTSReady', params: { ok: true, requestID: 'nope' } });
    bot.handleWsMessage({ event: 'cacheTTSReady', params: { ok: true } }); // no requestID
    assert.equal(bot.pendingPrecache.size, 0);
    bot.stop();
});

test('precacheTTSMany resolves when every phrase is ready', async () => {
    const bot = new ProPBXSDK(cfg);
    const p = bot.precacheTTSMany([
        { text: 'a', voice: 'v1' },
        { text: 'b', voice: 'v2' },
    ]);
    const ids = [...bot.pendingPrecache.keys()];
    assert.equal(ids.length, 2);
    for (const requestID of ids) {
        bot.handleWsMessage({ event: 'cacheTTSReady', params: { ok: true, requestID } });
    }
    await p;
    assert.equal(bot.pendingPrecache.size, 0);
    bot.stop();
});
