export interface InfobotConfig {
    appId: string;
    url: string;
    key: string;
    disableReconnect?: boolean;
    pingEnable?: boolean;
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
