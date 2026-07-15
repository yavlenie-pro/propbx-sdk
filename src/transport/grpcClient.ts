/**
 * gRPC transport for the v2 SDK. Owns the AppGateway client, the bidirectional
 * Session control stream and the MediaStream recording downlink, plus the
 * reconnect/backoff loop. It presents a WebSocket-like surface to the ProPBX
 * class: `sendAction(actionObject)` writes a control action, and a `'message'`
 * event delivers decoded, v1-shaped message objects the existing class handlers
 * already understand.
 *
 * Translation rules (verified against the server):
 *  - send: a v1 action object `{ action, callID, ...rest }` becomes
 *    `ClientFrame{ action:{ type:action, call_id:callID, params:rest } }`.
 *    The server flattens `params` back into a v1 message, so EVERYTHING except
 *    `action`/`callID` must go into `params`.
 *  - receive: `ServerFrame{ event:{ type, call_id, params } }` becomes
 *    `{ event:type, callID:call_id, params, playbackID, recordingID, sessionID }`
 *    — the id fields are hoisted out of `params` because the v1 classes read
 *    them at the top level.
 */
import * as path from 'path';
import { EventEmitter } from 'events';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { InfobotConfig } from '../types';
import { toActionFrame, toClientMessage } from './mapping';
import { MediaAssembler, ReassembledMedia } from '../media/mediaAssembler';
import { RecordingCorrelator } from '../media/recordingCorrelator';

const PROTO_PATH = path.join(__dirname, '..', '..', 'proto', 'app_gateway.proto');
const PROTOCOL_VERSION = 2;
const SDK_VERSION = 'node-2.0.0';
const MIN_KEEPALIVE_MS = 10000;
const DEFAULT_KEEPALIVE_MS = 25000;
const DEFAULT_RECONNECT_BASE_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 30000;
const MEDIA_REOPEN_DELAY_MS = 500;

const RECORDING_EVENTS = new Set(['recordingComplete', 'callFinished']);
const EVENT_CALL_FINISHED = 'callFinished';
const EVENT_CALL_DISCONNECTED = 'call-disconnected';
const NOOP = (): void => {};

/** Strip a `scheme://` prefix and any path so v1 `wss://host/...` URLs still work. */
export function toGrpcTarget(url: string): string {
    let t = (url || '').trim();
    t = t.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    t = t.replace(/\/.*$/, '');
    return t;
}

let cachedService: any = null;
function loadService(): any {
    if (cachedService) return cachedService;
    const packageDef = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
    });
    const proto: any = grpc.loadPackageDefinition(packageDef);
    cachedService = proto.propbx.v2.AppGateway;
    return cachedService;
}

export class GrpcTransport extends EventEmitter {
    private readonly config: InfobotConfig;
    private readonly target: string;
    private client: any = null;
    private sessionStream: grpc.ClientDuplexStream<any, any> | null = null;
    private mediaStream: grpc.ClientReadableStream<any> | null = null;

    private sessionToken = '';
    private ready = false;
    private stopped = false;
    private epoch = 0;
    private backoffAttempt = 0;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private mediaReopenTimer: NodeJS.Timeout | null = null;
    private readonly outbound: any[] = [];

    private readonly assembler = new MediaAssembler();
    private readonly correlator: RecordingCorrelator;
    // Per-call promise that settles when a held `callFinished` has been dispatched.
    // `call-disconnected` for the same call waits on it so the terminal event is
    // never overtaken by teardown (see onEvent).
    private readonly pendingFinishByCall = new Map<string, Promise<void>>();

    constructor(config: InfobotConfig) {
        super();
        this.config = config;
        this.target = toGrpcTarget(config.url);
        this.setMaxListeners(0);
        this.correlator = new RecordingCorrelator({
            recordingTimeoutMs: config.recordingTimeoutMs,
        });
        this.assembler.on('media', (m: ReassembledMedia) => this.correlator.addMedia(m));
        this.assembler.on('mediaError', (e: any) => this.emit('mediaError', e));
    }

    isReady(): boolean {
        return this.ready && !!this.sessionStream;
    }

    start(): void {
        this.stopped = false;
        this.ensureClient();
        this.openSession();
    }

    private ensureClient(): void {
        if (this.client) return;
        const Service = loadService();
        const creds = this.config.tls
            ? grpc.credentials.createSsl()
            : grpc.credentials.createInsecure();
        const keepaliveMs = Math.max(this.config.keepaliveMs ?? DEFAULT_KEEPALIVE_MS, MIN_KEEPALIVE_MS);
        const channelOptions: grpc.ClientOptions = {
            'grpc.keepalive_time_ms': keepaliveMs,
            'grpc.keepalive_timeout_ms': 10000,
            'grpc.keepalive_permit_without_calls': 1,
            'grpc.http2.max_pings_without_data': 0,
            'grpc.max_receive_message_length': 16 * 1024 * 1024,
            'grpc.max_send_message_length': 8 * 1024 * 1024,
        };
        this.client = new Service(this.target, creds, channelOptions);
    }

    private makeMetadata(): grpc.Metadata {
        const md = new grpc.Metadata();
        md.set('app-id', this.config.appId);
        md.set('app-key', this.config.key);
        return md;
    }

    // ---- Session ----------------------------------------------------------

    private openSession(): void {
        if (this.stopped) return;
        this.ready = false;
        const ep = this.epoch;
        const stream: grpc.ClientDuplexStream<any, any> = this.client.Session(this.makeMetadata());
        this.sessionStream = stream;

        stream.on('data', (frame: any) => {
            if (ep !== this.epoch) return;
            this.onSessionFrame(frame);
        });
        stream.on('error', (err: grpc.ServiceError) => {
            if (ep !== this.epoch) return;
            this.onSessionDown(err);
        });
        stream.on('end', () => {
            if (ep !== this.epoch) return;
            this.onSessionDown(null);
        });

        // First frame MUST be Hello.
        this.safeWrite(stream, {
            hello: {
                protocol: PROTOCOL_VERSION,
                sdk_version: SDK_VERSION,
                max_chunk_bytes: this.config.maxChunkBytes ?? 0,
            },
        });
    }

    private onSessionFrame(frame: any): void {
        if (frame.welcome) {
            this.onWelcome(frame.welcome);
        } else if (frame.event) {
            this.onEvent(frame.event);
        }
    }

    private onWelcome(welcome: any): void {
        this.sessionToken = welcome.session_token;
        this.ready = true;
        this.backoffAttempt = 0;
        this.openMediaStream();
        this.flushOutbound();
        // Welcome is the v2 analog of the v1 'auth-ok' WS event.
        this.emit('message', { event: 'auth-ok', params: welcome });
    }

    private onEvent(ev: any): void {
        const message: any = toClientMessage(ev);
        const ep = this.epoch;
        const callId: string | undefined = message.callID;

        const dispatch = (m: any): void => {
            if (ep === this.epoch && !this.stopped) this.emit('message', m);
        };

        if (RECORDING_EVENTS.has(ev.type)) {
            // Hold the event until its audio reassembles (or times out), then
            // dispatch with the recording entry populated in the v1 shape.
            const done = this.correlator
                .correlate(message, ev.type)
                .then(dispatch, () => dispatch(message));

            // `callFinished` is the terminal control event, sent by the server
            // right BEFORE `call-disconnected`. We hold it here waiting for the
            // recording bytes, but `call-disconnected` is NOT held — so without
            // ordering it overtakes the held `callFinished`, the class layer
            // removes the call, and the late `callFinished` is then dropped as
            // belonging to an already-finished call (losing its duration AND its
            // recording). Remember the in-flight dispatch so `call-disconnected`
            // can wait behind it and the server's ordering is preserved.
            if (ev.type === EVENT_CALL_FINISHED && callId) {
                const settled = done.then(NOOP, NOOP);
                this.pendingFinishByCall.set(callId, settled);
                void settled.then(() => {
                    if (this.pendingFinishByCall.get(callId) === settled) {
                        this.pendingFinishByCall.delete(callId);
                    }
                });
            }
            return;
        }

        // Hold `call-disconnected` behind a still-pending `callFinished` for the
        // same call, restoring the server's callFinished→call-disconnected order.
        if (ev.type === EVENT_CALL_DISCONNECTED && callId) {
            const pending = this.pendingFinishByCall.get(callId);
            if (pending) {
                void pending.then(() => dispatch(message));
                return;
            }
        }

        dispatch(message);
    }

    private onSessionDown(err: grpc.ServiceError | null): void {
        if (err && err.code === grpc.status.UNAUTHENTICATED) {
            this.emit('message', { event: 'auth-fail', params: { error: err.details } });
        }
        this.scheduleReconnect();
    }

    // ---- MediaStream ------------------------------------------------------

    private openMediaStream(): void {
        if (this.stopped || !this.sessionToken) return;
        const ep = this.epoch;
        const stream: grpc.ClientReadableStream<any> = this.client.MediaStream(
            { session_token: this.sessionToken, max_chunk_bytes: this.config.maxChunkBytes ?? 0 },
            this.makeMetadata(),
        );
        this.mediaStream = stream;
        stream.on('data', (chunk: any) => {
            if (ep !== this.epoch) return;
            this.assembler.push(chunk);
        });
        stream.on('error', () => {
            if (ep !== this.epoch) return;
            this.reopenMediaStream();
        });
        stream.on('end', () => {
            if (ep !== this.epoch) return;
            this.reopenMediaStream();
        });
    }

    /** MediaStream dropped but the Session is still up — reopen with the same token. */
    private reopenMediaStream(): void {
        if (this.stopped || !this.ready) return;
        if (this.mediaReopenTimer) return;
        this.mediaReopenTimer = setTimeout(() => {
            this.mediaReopenTimer = null;
            if (!this.stopped && this.ready) this.openMediaStream();
        }, MEDIA_REOPEN_DELAY_MS);
        if (typeof this.mediaReopenTimer.unref === 'function') this.mediaReopenTimer.unref();
    }

    // ---- Reconnect --------------------------------------------------------

    private scheduleReconnect(): void {
        // Invalidate in-flight callbacks from the dying session.
        this.epoch += 1;
        this.ready = false;
        this.teardownStreams();

        // Partial reassemblies and the old token are unrecoverable across a new Session.
        this.assembler.reset();
        this.correlator.dispose();
        this.pendingFinishByCall.clear();
        this.sessionToken = '';

        // Let ProPBX clear its calls and surface a user-facing 'reconnect'.
        this.emit('reconnect');

        if (this.stopped || this.config.disableReconnect === true) return;

        const base = this.config.reconnectTimeout ?? DEFAULT_RECONNECT_BASE_MS;
        const max = this.config.maxReconnectBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
        const expo = Math.min(base * Math.pow(2, this.backoffAttempt), max);
        const delay = Math.floor(expo / 2 + Math.random() * (expo / 2)); // jitter in [expo/2, expo]
        this.backoffAttempt += 1;

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.openSession();
        }, delay);
        if (typeof this.reconnectTimer.unref === 'function') this.reconnectTimer.unref();
    }

    private teardownStreams(): void {
        if (this.mediaReopenTimer) {
            clearTimeout(this.mediaReopenTimer);
            this.mediaReopenTimer = null;
        }
        if (this.mediaStream) {
            try {
                this.mediaStream.removeAllListeners('data');
                this.mediaStream.cancel();
            } catch {
                /* already closed */
            }
            this.mediaStream = null;
        }
        if (this.sessionStream) {
            try {
                this.sessionStream.removeAllListeners('data');
                this.sessionStream.cancel();
            } catch {
                /* already closed */
            }
            this.sessionStream = null;
        }
    }

    // ---- Outbound ---------------------------------------------------------

    sendAction(data: any): void {
        if (this.stopped) return;
        if (!this.isReady()) {
            this.outbound.push(data);
            return;
        }
        this.writeAction(data);
    }

    private writeAction(data: any): void {
        this.safeWrite(this.sessionStream!, { action: toActionFrame(data) });
    }

    private flushOutbound(): void {
        while (this.outbound.length > 0 && this.isReady()) {
            this.writeAction(this.outbound.shift());
        }
    }

    private safeWrite(stream: grpc.ClientDuplexStream<any, any>, frame: any): void {
        try {
            stream.write(frame);
        } catch {
            // The stream raced a close; the error/end handler drives reconnect.
        }
    }

    // ---- Shutdown ---------------------------------------------------------

    stop(): void {
        this.stopped = true;
        this.epoch += 1;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.sessionStream) {
            try {
                this.sessionStream.end();
            } catch {
                /* noop */
            }
        }
        this.teardownStreams();
        this.correlator.dispose();
        this.assembler.reset();
        if (this.client) {
            try {
                this.client.close();
            } catch {
                /* noop */
            }
            this.client = null;
        }
        this.ready = false;
    }
}
