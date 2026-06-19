import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import protoLoader from '@grpc/proto-loader';
import { toActionFrame } from '../dist/transport/mapping.js';
import { structToPlain } from '../dist/transport/struct.js';

// Exercises the REAL @grpc/proto-loader (de)serialization the transport runs on
// the wire, with the same options as transport/grpcClient. This is what proves
// that plainToStruct produces a Struct shape proto-loader actually serializes —
// the unit tests of toActionFrame only check the JS shape, not the wire bytes,
// which is how the "empty params on the server" bug shipped.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, '..', 'proto', 'app_gateway.proto');

const pd = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
});
const Session = pd['propbx.v2.AppGateway'].Session;

test('action params survive a real proto-loader Struct serialize/deserialize round-trip', () => {
    const plain = {
        text: 'Здравствуйте!',
        playbackID: 'p1',
        volume: 7,
        ssml: false,
        headers: { 'X-a': 'b' },
        tags: ['x', 'y'],
    };
    // tts as the app sends it: { action, callID, params: {...} }.
    const frame = { action: toActionFrame({ action: 'tts', callID: 'c1', params: plain }) };

    const buf = Session.requestSerialize(frame);
    assert.ok(buf.length > 0, 'serialized ClientFrame must be non-empty');

    const back = Session.requestDeserialize(buf);
    assert.equal(back.action.type, 'tts');
    assert.equal(back.action.call_id, 'c1');
    // The Go server does params.AsMap(); structToPlain mirrors that flattening.
    // toActionFrame nests the app's params under a `params` key (v1 contract).
    assert.deepEqual(structToPlain(back.action.params), { params: plain });
});

test('empty params round-trips to an empty object (answer-style action)', () => {
    const frame = { action: toActionFrame({ action: 'answer', callID: 'c2' }) };
    const back = Session.requestDeserialize(Session.requestSerialize(frame));
    assert.equal(back.action.type, 'answer');
    assert.equal(back.action.call_id, 'c2');
    assert.deepEqual(structToPlain(back.action.params), {});
});
