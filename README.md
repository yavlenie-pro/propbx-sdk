# propbx-sdk (v2, gRPC)

Node.js SDK for the ProPBX telephony server. v2 speaks **gRPC** instead of the
legacy WebSocket transport, but exposes the **same** high-level API and events as
v1 — existing bots migrate with a near-zero diff.

## Why v2

v1 carried the control plane of every call on one WebSocket and delivered call
recordings inline as base64 inside `callFinished`. A long recording produced a
frame larger than the client's `maxPayload`, the socket closed with code **1009
(message too big)**, and the server dropped *every* call on that connection.

v2 splits the wire into two gRPC streams over one HTTP/2 connection:

- **Session** — bidirectional control plane (the same actions/events as v1).
- **MediaStream** — recording bytes as bounded chunks on a separate stream.

A large recording can no longer stall or drop the control plane. The SDK
reassembles MediaStream chunks and **transparently** injects the audio back into
the `recordingComplete` / `callFinished` recording entry in the v1 shape, so bot
code does not need to change.

## Install

```
npm install propbx-sdk
```

Requires Node ≥ 16.

## Usage

```js
import ProPBXSDK from 'propbx-sdk';

const bot = new ProPBXSDK.ProPBXSDK({
    url: 'pbx.example.com:9091',  // gRPC host:port
    appId: process.env.COMM_APP_ID,
    key: process.env.COMM_APP_KEY,
    pingEnable: true,
    // tls: true,                 // TLS for the gRPC channel (default: insecure)
    // disableReconnect: true,
});

bot.start();

bot.on('connected', () => console.log('ready'));

bot.on('incomingCall', (call, params) => {
    call.answer();

    const recording = call.startAudioRecord('wav');
    recording.on('recordingComplete', (msg) => {
        // msg.params.buffer  -> Buffer (raw WAV)
        // msg.params.data    -> base64 (v1-compatible)
        // msg.params.binaryData -> base64 (legacy field, == data)
    });

    const playback = call.say('Здравствуйте', { provider: 'yandex', voice: { id: 'alyss' } });
    playback.on('playbackFinished', () => {
        const asr = call.startSpeechRecognition({ provider: 'yandex', language: 'ru-RU', grammar: 'general', timeout: 30000 });
        asr.on('transcribe', (m) => console.log('heard:', m.params));
    });
});

bot.on('callFinished', (call, params) => {
    // params.recordings[i] carry { recordingID, format, size, duration_ms, data, binaryData, buffer }
});

// Graceful shutdown — drains THIS instance only.
process.on('SIGTERM', () => { bot.stop(); process.exit(0); });
process.on('SIGINT',  () => { bot.stop(); process.exit(0); });
```

The full call/playback/recognition/recording/variables API is identical to v1:
`answer`, `hangup`, `say`, `playURL`, `playFile`, `forward`, `startBackgroundSound`,
`variables.{get,set,delete}`, `startSpeechRecognition[WithCustomConfig]`,
`startAudioRecord`, `reachMarker`, etc.

## TTS precache

`precacheTTS()` pre-synthesizes a phrase into the server's TTS cache so a later
`say()`/`tts` of the same phrase plays instantly (no mid-call synthesis latency).
It's a **connection-level** command — no active call required.

```js
bot.on('connected', async () => {
    // Precache greetings up front. opts MUST match the later say() opts exactly.
    await bot.precacheTTS('Здравствуйте', { voice: 'alena', provider: 'yandex', language: 'ru-RU' });

    // Or many at once:
    await bot.precacheTTSMany([
        { text: 'Здравствуйте', voice: 'alena', provider: 'yandex' },
        { text: 'До свидания',  voice: 'alena', provider: 'yandex' },
    ]);
});

bot.on('incomingCall', (call) => {
    call.answer();
    // Cache HIT — plays without synthesis delay (same opts as the precache).
    call.say('Здравствуйте', { voice: 'alena', provider: 'yandex', language: 'ru-RU' });
});
```

The promise resolves on `cacheTTSReady{ ok: true }`, and rejects on
`{ ok: false }` (with the server error), on `timeoutMs` (default 30000), or if the
connection drops / the SDK shuts down while pending.

> The server cache key is `sha256(text, voice, language, emotion, speed, ssml,
> provider)`. The precache `opts` must **exactly equal** the later `tts` opts —
> any mismatch is a cache miss.

## Migrating from v1

| | v1 | v2 |
|---|---|---|
| Transport | WebSocket | gRPC (`@grpc/grpc-js`) |
| `url` | `wss://host/...` | `host:port` (a `wss://` scheme is accepted and stripped) |
| Auth | `auth` action | `app-id` / `app-key` gRPC metadata (automatic) |
| Recording bytes | inline base64 in `callFinished` | reassembled from MediaStream, **injected into the same entry** (`data`/`binaryData`/`buffer`) |
| Liveness | app-level WS ping | gRPC keepalive (automatic) |
| Shutdown | — | `bot.stop()` / `bot.close()` — never `stopApp()` on a signal |

Public class/event names and method signatures are unchanged. In practice the
only required change for most bots is the `url` value.

> **`stopApp()` is app-global.** It stops the application server-side for *all*
> instances of your `app_id`. Never wire it to SIGTERM/SIGINT — use `bot.stop()`.

## Configuration

| option | default | notes |
|---|---|---|
| `url` | — | gRPC `host:port` |
| `appId`, `key` | — | sent as `app-id` / `app-key` metadata |
| `tls` | `false` | use TLS for the channel |
| `disableReconnect` | `false` | disable the auto-reconnect loop |
| `maxChunkBytes` | server default (64 KiB) | client MediaChunk ceiling |
| `recordingTimeoutMs` | `15000` | hold a recording event this long awaiting bytes before emitting metadata-only |
| `keepaliveMs` | `25000` | gRPC keepalive period (clamped to ≥ 10 s) |
| `maxReconnectBackoffMs` | `30000` | upper bound on reconnect backoff |

## Develop

```
npm run build    # tsc -> dist/
npm test         # build + unit tests (node:test)
```

Live smoke test against a running server (`grpc.enabled: true`, `:9091`):

```
PBX_HOST=localhost:9091 PBX_APP_ID=... PBX_APP_KEY=... npm run smoke
```

End-to-end recording verification (make a real recorded call, confirm
`callFinished` carries metadata and the audio reassembles byte-identical from
MediaStream) is a manual step against a live server with a call endpoint.
