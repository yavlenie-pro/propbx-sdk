import { v1 as uuidv1, v4 as uuidv4 } from 'uuid';
import EventEmitter from 'events';
import ProPBXCall from './call';
import { WS_EVENTS, APP_EVENTS } from './events';
import * as actions from './actions';
import { GrpcTransport } from './transport/grpcClient';
import { InfobotConfig, PrecacheTTSOptions } from './types';

interface PendingPrecache {
    resolve: () => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
}

export default class ProPBX extends EventEmitter {
    private config: InfobotConfig;
    maxCallTimeout: number;
    maxListeners: number;
    reconnectTimeout: number;
    pingTimeout: number;
    pingInterval: number;
    pingEnable: boolean;

    transport!: GrpcTransport;
    calls: Record<string, ProPBXCall> = {};
    finishedCalls: Set<string> = new Set();
    private callTimers: Record<string, NodeJS.Timeout> = {};
    private pendingPrecache: Map<string, PendingPrecache> = new Map();

    constructor(
        config: InfobotConfig,
        maxCallTimeout = 5 * 60 * 1000,
        maxListeners = 200,
        reconnectTimeout = 500,
        pingTimeout = 60000,
        pingInterval = 5000,
        pingEnable = false,
    ) {
        super();
        this.config = config;
        this.maxCallTimeout = maxCallTimeout;
        this.maxListeners = maxListeners;
        this.reconnectTimeout = reconnectTimeout;
        this.pingTimeout = pingTimeout;
        this.pingInterval = pingInterval;
        this.pingEnable = pingEnable;
        this.setMaxListeners(maxListeners);
        this.pingEnable = this.config.pingEnable as boolean;
        // reconnectTimeout feeds the transport's backoff base.
        if (this.config.reconnectTimeout == null) {
            this.config.reconnectTimeout = reconnectTimeout;
        }
    }

    start(): this {
        this.connect();
        return this;
    }

    private send(data: any): void {
        if (this.transport) {
            this.transport.sendAction(data);
        }
    }

    /** Dispatch a decoded, v1-shaped message from the transport. */
    private handleWsMessage(message: any): void {
        const { event } = message;
        switch (event) {
            case WS_EVENTS.AUTH_OK:
                this.emit(APP_EVENTS.CONNECTED);
                break;
            case WS_EVENTS.AUTH_FAIL:
                this.emit(APP_EVENTS.AUTH_FAIL);
                break;
            case WS_EVENTS.FILE_STORED:
                this.emit(APP_EVENTS.FILE_STORED, message);
                break;
            case WS_EVENTS.FILE_STORE_ERROR:
                this.emit(APP_EVENTS.FILE_STORE_ERROR, message);
                break;
            case WS_EVENTS.CACHE_TTS_READY:
                this.handleCacheTTSReady(message);
                break;
            default:
                this.handleCallWsMessage(message);
        }
    }

    /** Route a `cacheTTSReady` event to the matching pending precache promise. */
    private handleCacheTTSReady(message: any): void {
        const params = message.params ?? {};
        const requestID = params.requestID;
        if (!requestID) return; // can't correlate without it
        const pending = this.pendingPrecache.get(requestID);
        if (!pending) return; // unknown / already settled (timeout, drop)
        clearTimeout(pending.timer);
        this.pendingPrecache.delete(requestID);
        if (params.ok === true) {
            pending.resolve();
        } else {
            pending.reject(new Error(params.error || 'precacheTTS failed'));
        }
    }

    private handleCallWsMessage(message: any): void {
        const { event } = message;
        // Server-side no-op emitted every ~60s for calls sitting in an active
        // bridge, purely to reset the inactivity timer. Never create a call for
        // it (a keepalive for an untracked call would spawn a phantom object)
        // and don't surface it to listeners.
        if (event === WS_EVENTS.CALL_KEEPALIVE) {
            this.getCall(message.callID);
            return;
        }
        let call = this.getCall(message.callID);
        if (!call) {
            if (this.finishedCalls.has(message.callID)) {
                return;
            }
            call = new ProPBXCall(message.callID, this.transport, message.params);
            this.calls[message.callID] = call;
        }
        if (event === WS_EVENTS.FORWARD_STARTED || event === WS_EVENTS.FORWARDED_CALL_ANSWERED) {
            call.isBridged = true;
        } else if (
            event === WS_EVENTS.FORWARDED_CALL_FINISHED ||
            event === WS_EVENTS.FORWARDED_CALL_FAILED ||
            event === WS_EVENTS.FORWARDED_CALL_NOT_ANSWERED
        ) {
            call.isBridged = false;
        }
        if (event === WS_EVENTS.ERROR) {
            this.emit(APP_EVENTS.BOT_ERROR, call);
            call.processEvent(APP_EVENTS.BOT_ERROR, message.params, message);
            return;
        }
        if (event === WS_EVENTS.CALL_DISCONNECTED) {
            call.isConnected = false;
            this.emit(event, call, message.params);
            call.processEvent(APP_EVENTS.CALL_DISCONNECTED, message.params, message);
            this.removeCall(message.callID);
            return;
        }
        if (event === WS_EVENTS.CALL_FINISHED) {
            call.isConnected = false;
            this.emit(event, call, message.params);
            call.processEvent(event, message.params, message);
            this.removeCall(message.callID);
            return;
        }
        this.emit(event, call, message.params);
        call.processEvent(event, message.params, message);
        if (event === WS_EVENTS.PING) call.pong();
    }

    private connect(): void {
        this.transport = new GrpcTransport(this.config);
        this.transport.on('message', (msg: any) => this.handleWsMessage(msg));
        this.transport.on('reconnect', () => this.onReconnect());
        this.transport.start();
    }

    /**
     * Transport is (re)connecting. Mirror the v1 reconnect bookkeeping: surface a
     * user-facing `reconnect`, drop tracked calls, and clear the finished set —
     * WITHOUT touching user listeners on this instance. The transport owns the
     * backoff/redial loop and honors `config.disableReconnect`.
     */
    private onReconnect(): void {
        this.emit(WS_EVENTS.RECONNECT);
        for (const callId of Object.keys(this.calls)) {
            this.removeCall(callId);
        }
        this.finishedCalls.clear();
        // Pending precache requests are bound to the dropped session — fail them.
        this.rejectAllPrecache('precacheTTS aborted: connection lost');
    }

    /**
     * DANGER: stops the application server-side for ALL instances of this app_id.
     * Do NOT wire this to SIGTERM/SIGINT — use `stop()` to drain just this
     * instance. Kept for parity with v1 / control tooling.
     */
    stopApp(): void {
        this.send({ action: actions.ACTIONS.STOP_APP });
    }

    /**
     * Graceful local shutdown: drop tracked calls and close the gRPC streams so
     * the server removes this instance from its carousel. Safe for SIGTERM/SIGINT
     * (followed by process.exit). Does NOT stop the app for other instances.
     */
    stop(): void {
        for (const callId of Object.keys(this.calls)) {
            this.removeCall(callId);
        }
        this.finishedCalls.clear();
        this.rejectAllPrecache('precacheTTS aborted: SDK stopped');
        if (this.transport) {
            this.transport.stop();
        }
    }

    /** Alias for {@link stop}. */
    close(): void {
        this.stop();
    }

    /**
     * Pre-synthesize a TTS phrase into the server's cache so a later `tts` of the
     * same phrase plays instantly (no mid-call synthesis latency). This is a
     * connection-level command — it does NOT require an active call.
     *
     * IMPORTANT: the `opts` here must EXACTLY match the options you later pass to
     * the `tts` action (`call.say(text, opts)`), because the server cache key is
     * `sha256(text, voice, language, emotion, speed, ssml, provider)` — any
     * mismatch is a cache miss.
     *
     * Resolves when the server reports `cacheTTSReady{ ok: true }`, rejects on
     * `{ ok: false }` (with the server error), on timeout, or if the connection
     * drops / the SDK shuts down while the request is pending.
     */
    precacheTTS(text: string, opts: PrecacheTTSOptions = {}): Promise<void> {
        if (!text) {
            return Promise.reject(new Error('precacheTTS: text is required'));
        }
        const requestID = uuidv4();
        const timeoutMs = opts.timeoutMs ?? 30000;
        return new Promise<void>((resolve, reject) => {
            // Not unref'd on purpose: a pending precache is real outstanding work,
            // and the timer must fire to reject if the server never answers.
            const timer = setTimeout(() => {
                this.pendingPrecache.delete(requestID);
                reject(new Error(`precacheTTS timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pendingPrecache.set(requestID, { resolve, reject, timer });
            this.send(actions.precacheTTS(text, requestID, opts));
        });
    }

    /**
     * Precache many phrases at once. Each entry is `{ text, ...PrecacheTTSOptions }`.
     * Resolves when all succeed; rejects fast on the first failure (the other
     * requests still settle and clean themselves up).
     */
    precacheTTSMany(phrases: Array<{ text: string } & PrecacheTTSOptions>): Promise<void[]> {
        return Promise.all(phrases.map(({ text, ...opts }) => this.precacheTTS(text, opts)));
    }

    /** Reject every pending precache promise (connection drop / shutdown) and clear the map. */
    private rejectAllPrecache(reason: string): void {
        for (const pending of this.pendingPrecache.values()) {
            clearTimeout(pending.timer);
            pending.reject(new Error(reason));
        }
        this.pendingPrecache.clear();
    }

    getCallsCount(): number {
        return Object.keys(this.calls).length;
    }

    getCall(callId: string): ProPBXCall | undefined {
        const call = this.calls[callId];
        if (!call) return undefined;
        this.touchCall(callId);
        return call;
    }

    /**
     * Drop a tracked call. The `finishedCalls` tombstone (which makes every
     * later event for this callID silently dropped) is only written when the
     * removal is authoritative — server said the call ended, or we're tearing
     * down. An inactivity expiry passes `expired = true` to skip it, so a late
     * `forwardedCallFinished`/`callFinished` can still recreate the call and
     * reach instance-level listeners instead of vanishing.
     */
    removeCall(callId: string, expired = false): boolean {
        if (this.callTimers[callId]) {
            clearTimeout(this.callTimers[callId]);
            delete this.callTimers[callId];
        }
        if (this.calls[callId]) {
            if (!expired) {
                this.finishedCalls.add(callId);
            }
            this.calls[callId].removeAllListeners();
            delete this.calls[callId];
            return true;
        }
        return false;
    }

    makeCall(to: any, opts: any): ProPBXCall {
        const callID = uuidv1();
        const call = new ProPBXCall(callID, this.transport);
        this.calls[callID] = call;
        this.touchCall(callID);
        const params = Object.assign(Object.assign({}, opts), { appID: this.config.appId, callID });
        this.send(actions.makeCall({ to, params }));
        return call;
    }

    private touchCall(callId: string): void {
        if (this.callTimers[callId]) {
            clearTimeout(this.callTimers[callId]);
        }
        this.callTimers[callId] = setTimeout(this.expireCall.bind(this), this.maxCallTimeout, callId);
    }

    /**
     * Inactivity timer fired. A bridged call is silent by design for however
     * long the operator conversation lasts — re-arm instead of GC'ing it (the
     * bridge always terminates with `forwardedCallFinished`, which is also the
     * escape hatch if the flag somehow sticks: `callFinished` follows it and
     * removes the call for real).
     */
    private expireCall(callId: string): void {
        const call = this.calls[callId];
        if (call && call.isBridged) {
            this.touchCall(callId);
            return;
        }
        this.removeCall(callId, true);
    }
}
