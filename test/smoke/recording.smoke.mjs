/**
 * Live-server smoke test. Skipped unless PBX_HOST / PBX_APP_ID / PBX_APP_KEY are
 * set, so it is safe to leave in the default `npm test` run (shows as skipped).
 *
 * Run a propbx server from `feat/grpc-sdk-v2` with grpc.enabled:true and
 * grpc.listen_addr ":9091", then:
 *   PBX_HOST=localhost:9091 PBX_APP_ID=... PBX_APP_KEY=... npm run smoke
 *
 * Deeper end-to-end checks (make-call/incomingCall round-trip and byte-identical
 * recording reassembly) require a real call endpoint and are documented in the
 * README as a manual verification step.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
// dist is CommonJS; mirror the v1-compatible default-import-then-destructure pattern
// (Node's ESM loader can't statically detect the getter-based named exports).
import pkg from '../../dist/index.js';
const { ProPBXSDK } = pkg;

const RUN = process.env.PBX_HOST && process.env.PBX_APP_ID && process.env.PBX_APP_KEY;
const skip = RUN ? false : 'set PBX_HOST / PBX_APP_ID / PBX_APP_KEY to run the live smoke test';

test('connects and receives Welcome (-> "connected")', { skip }, async () => {
    const bot = new ProPBXSDK({
        url: process.env.PBX_HOST,
        appId: process.env.PBX_APP_ID,
        key: process.env.PBX_APP_KEY,
        pingEnable: true,
        tls: process.env.PBX_TLS === '1',
    });

    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('no "connected" within 10s')), 10000);
            bot.on('connected', () => {
                clearTimeout(timer);
                resolve();
            });
            bot.on('AUTH_FAIL', () => {
                clearTimeout(timer);
                reject(new Error('UNAUTHENTICATED — bad app-id/app-key'));
            });
            bot.start();
        });
        assert.ok(true, 'Welcome received');
    } finally {
        bot.stop();
    }
});

test('rejects bad credentials with AUTH_FAIL', { skip }, async () => {
    const bot = new ProPBXSDK({
        url: process.env.PBX_HOST,
        appId: 'definitely-not-a-real-app',
        key: 'definitely-not-a-real-key',
        pingEnable: true,
        tls: process.env.PBX_TLS === '1',
        disableReconnect: true,
    });
    try {
        const result = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('no AUTH_FAIL within 10s')), 10000);
            bot.on('AUTH_FAIL', () => {
                clearTimeout(timer);
                resolve('auth-fail');
            });
            bot.on('connected', () => {
                clearTimeout(timer);
                reject(new Error('unexpectedly connected with bad creds'));
            });
            bot.start();
        });
        assert.equal(result, 'auth-fail');
    } finally {
        bot.stop();
    }
});
