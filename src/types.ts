/**
 * Public type surface. `InfobotConfig` keeps the v1 fields so existing bots
 * construct the SDK unchanged; the new optional fields tune the gRPC transport.
 */
export interface InfobotConfig {
    appId: string;
    /**
     * Server address. In v2 this is a gRPC `host:port` (e.g. `pbx.example.com:9091`).
     * A `ws://` / `wss://` / `grpc://` / `https://` scheme (and trailing slash) is
     * accepted and stripped for backward compatibility with v1 config.
     */
    url: string;
    key: string;
    disableReconnect?: boolean;
    /** Kept for source-compat. Liveness is handled by gRPC keepalive in v2. */
    pingEnable?: boolean;

    // ---- v2 (gRPC) options ----
    /** Use TLS for the gRPC channel. Default false (insecure). */
    tls?: boolean;
    /** Largest MediaChunk.data the client wants, bytes. 0/undefined = server default (64 KiB). */
    maxChunkBytes?: number;
    /**
     * How long to hold a `recordingComplete`/`callFinished` event waiting for its
     * audio bytes to finish reassembling before emitting it metadata-only. ms.
     * Default 15000.
     */
    recordingTimeoutMs?: number;
    /** gRPC keepalive ping period, ms. Must be >= 10000 (server enforced min). Default 25000. */
    keepaliveMs?: number;
    /** Base reconnect backoff, ms (first retry). Default 500. Set from the ProPBX constructor arg. */
    reconnectTimeout?: number;
    /** Upper bound on reconnect backoff, ms. Default 30000. */
    maxReconnectBackoffMs?: number;
}

export interface WsMessage {
    event?: string;
    callID?: string;
    params?: any;
    playbackID?: string;
    recordingID?: string;
    sessionID?: string;
}

export interface Variable {
    value: string;
    name: string;
}

/**
 * A reassembled recording entry as surfaced to the app, identical in shape to
 * the v1 SDK plus a convenience `buffer`. `data`/`binaryData` are base64 WAV.
 */
export interface RecordingEntry {
    recordingID: string;
    format?: string;
    size?: number;
    duration_ms?: number;
    /** base64-encoded audio (v1-compatible). */
    data?: string;
    /** base64-encoded audio (legacy infobot field name, == data). */
    binaryData?: string;
    /** Raw audio bytes (v2 convenience; not present in v1). */
    buffer?: Buffer;
    [key: string]: any;
}

/**
 * Options for {@link ProPBX.precacheTTS}. To get a cache HIT on the later `tts`,
 * these must EXACTLY match the options passed to that `tts` (the server cache key
 * is `sha256(text, voice, language, emotion, speed, ssml, provider)`).
 */
export interface PrecacheTTSOptions {
    /** Voice id, or `{ id, speed?, emotion? }` — passed through exactly as the `tts` action does. */
    voice?: string | { id: string; speed?: number; emotion?: string };
    provider?: string;
    language?: string;
    speed?: number;
    ssml?: boolean;
    /** Max time to await `cacheTTSReady` before rejecting, ms. Default 30000 (server caps synthesis ~30s). */
    timeoutMs?: number;
}

/**
 * Server-side VAD (Voice Activity Detection) block for speech recognition.
 * Pass it to startSpeechRecognition to make the server end the phrase by real
 * audio silence (emitting a `speech-recognition-eou` event) instead of the
 * legacy text-debounce `timeout`. Omit it entirely to keep legacy behavior.
 * All fields are optional — the server fills in any that are missing.
 */
export interface VadConfig {
    /** Trailing silence that ends the phrase, ms. Server default: 700. */
    silence_ms?: number;
    /** Audio retained before speech onset, ms. Server default: 300. */
    prefix_padding_ms?: number;
    /** Hard cap on phrase length, ms; 0 disables the cap. Server default: 0. */
    max_phrase_ms?: number;
    /** Speech-probability threshold, 0..1. Server default: 0.5. */
    threshold?: number;
}

/** Negotiated session info captured from the gRPC Welcome frame. */
export interface WelcomeInfo {
    nodeId: string;
    applicationId: string;
    serverVersion: string;
    maxChunkBytes: number;
    sessionToken: string;
}
