/**
 * Action-object factories. These produce the exact v1 message shapes
 * (`{ action, params, ...}`); the gRPC transport then translates each into an
 * `Action{ type, call_id, params }` frame by stripping `action`/`callID` and
 * sending the remainder as the params Struct (see transport/grpcClient.ts).
 *
 * Kept 1:1 with the legacy SDK so server behavior cannot diverge. The only
 * change vs v1: `auth()` is never sent — credentials ride in gRPC metadata now.
 */
import { v1 as uuidv1 } from 'uuid';
import { Variable, VadConfig, PrecacheTTSOptions } from './types';

export const ACTIONS = {
    PONG: 'PONG',
    AUTH: 'auth',
    MAKE_CALL: 'make-call',
    HANGUP: 'hangup',
    ANSWER: 'answer',
    RING: 'ring',
    STOP_DELIVERY: 'stop-delivery',
    STOP_TRY: 'stop-try',
    START_CALL: 'start-call',
    FINISH_CALL: 'finish-call',
    START_AUDIO_STREAM: 'start-audio-stream',
    STOP_AUDIO_STREAM: 'stop-audio-stream',
    FORWARD_AUDIO_STREAM: 'forward-audio-stream',
    SEND_SMS: 'send-sms',
    CALL_FORWARD: 'call-forward',
    START_BACKGROUND_SOUND: 'start-background-sound',
    STOP_BACKGROUND_SOUND: 'stop-background-sound',
    CACHE_TTS: 'cache-tts',
    START_AUDIO_RECORD: 'start-audio-record',
    STOP_AUDIO_RECORD: 'stop-audio-record',
    TTS_ACTION: 'tts',
    PLAYBACK_ACTION: 'playback',
    PLAYBACK_FILE: 'playback-file',
    STOP_PLAYBACK: 'stop-playback',
    FILE_RESPONSE: 'file-response',
    START_SPEECH_RECOGNITION: 'start-speech-recognition',
    START_SPEECH_RECOGNITION_CUSTOM: 'start-speech-recognition-custom',
    STOP_SPEECH_RECOGNITION: 'stop-speech-recognition',
    REACH_MARKER: 'marker',
    VARIABLES_SET: 'variables-set',
    VARIABLES_DELETE: 'variables-delete',
    VARIABLES_GET: 'variables-get',
    STOP_APP: 'stop-app',
} as const;

export function variablesGet() {
    return { action: ACTIONS.VARIABLES_GET };
}

export function variablesSet(variables: Array<Variable>) {
    return { action: ACTIONS.VARIABLES_SET, params: { variables } };
}

export function variablesDelete(name: string) {
    return { action: ACTIONS.VARIABLES_DELETE, params: { name } };
}

export function reachMarker(blockId: number, name: string) {
    return { action: ACTIONS.REACH_MARKER, params: { blockId, name } };
}

/** @deprecated v2 sends credentials as gRPC metadata; this is never written to the wire. */
export function auth(appID: string, key: string) {
    return { action: ACTIONS.AUTH, appID, key };
}

export function makeCall(params: any = {}) {
    return Object.assign({ action: ACTIONS.MAKE_CALL }, params);
}

export function hangup(reason: any) {
    return {
        action: ACTIONS.HANGUP,
        params: {
            reason: reason,
        },
    };
}

export function answer() {
    return { action: ACTIONS.ANSWER };
}

export function ring() {
    return { action: ACTIONS.RING };
}

export function stopDelivery(params: any = {}) {
    return { action: ACTIONS.STOP_DELIVERY, params };
}

export function stopTry() {
    return { action: ACTIONS.STOP_TRY };
}

export function startCall(params: any = {}) {
    return { action: ACTIONS.START_CALL, params };
}

export function finishCall(params: any = {}) {
    return { action: ACTIONS.FINISH_CALL, params };
}

export function pong() {
    return { action: ACTIONS.PONG };
}

export function startAudioStream() {
    return { action: ACTIONS.START_AUDIO_STREAM };
}

export function stopAudioStream() {
    return { action: ACTIONS.STOP_AUDIO_STREAM };
}

export function forwardAudioStream(host: string, port: number | string) {
    return {
        action: ACTIONS.FORWARD_AUDIO_STREAM,
        params: { host, port },
    };
}

export function sendSms(
    to: string,
    text: string,
    digital: any,
    short: any,
    from: string,
    id?: string | number,
) {
    return { action: ACTIONS.SEND_SMS, to, text, from, digital, short, id: id || uuidv1() };
}

export function callForward(to: string, message: string, tts: any, headers: any = null) {
    return {
        action: ACTIONS.CALL_FORWARD,
        params: { to, message, tts, headers },
    };
}

export function startBackgroundSound(url: string, volume: any, repeat: any) {
    return {
        action: ACTIONS.START_BACKGROUND_SOUND,
        params: {
            url,
            repeat,
            volume,
        },
    };
}

export function cacheTTS(phrases: any) {
    return {
        action: ACTIONS.CACHE_TTS,
        params: {
            phrases: phrases,
        },
    };
}

/**
 * Connection-level TTS precache (no call). Builds the `cache-tts` action with a
 * single phrase + synthesis options + a correlation `requestID`. Only defined
 * options are included so the params match the later `tts` for a cache hit.
 */
export function precacheTTS(text: string, requestID: string, opts: PrecacheTTSOptions = {}) {
    const params: any = { text, requestID };
    if (opts.voice !== undefined) params.voice = opts.voice;
    if (opts.provider !== undefined) params.provider = opts.provider;
    if (opts.language !== undefined) params.language = opts.language;
    if (opts.speed !== undefined) params.speed = opts.speed;
    if (opts.ssml !== undefined) params.ssml = opts.ssml;
    return { action: ACTIONS.CACHE_TTS, params };
}

export function stopBackgroundSound() {
    return { action: ACTIONS.STOP_BACKGROUND_SOUND };
}

export function startAudioRecord(recordingID: string | number, format: any) {
    return {
        action: ACTIONS.START_AUDIO_RECORD,
        params: {
            format,
            recordingID,
        },
    };
}

export function stopAudioRecord(recordingID: string | number) {
    return {
        action: ACTIONS.STOP_AUDIO_RECORD,
        params: {
            recordingID,
        },
    };
}

export function ttsAction(playbackID: string | number, text: string, params: any = {}, ssml?: any) {
    return {
        action: ACTIONS.TTS_ACTION,
        params: Object.assign({ text, ssml, playbackID }, params),
    };
}

export function playbackAction(playbackID: string | number, url: string) {
    return {
        action: ACTIONS.PLAYBACK_ACTION,
        params: { url, playbackID },
    };
}

export function playbackFile(playbackID: string | number, fileHash: any, fileType: string | null) {
    return {
        action: ACTIONS.PLAYBACK_FILE,
        params: { fileHash, fileType, playbackID },
    };
}

export function fileResponse(playbackID: string | number, fileData: string, fileType: string | null) {
    return {
        action: ACTIONS.FILE_RESPONSE,
        params: { fileData, fileType, playbackID },
    };
}

export function stopPlayback(playbackID: string | number) {
    return {
        action: ACTIONS.STOP_PLAYBACK,
        params: {
            playbackID,
        },
    };
}

export function startSpeechRecognition(
    sessionID: string | number,
    provider: any,
    language: any,
    grammar: any,
    timeout: any,
    vad?: VadConfig,
) {
    const params: any = {
        provider,
        language,
        grammar,
        timeout,
        sessionID,
    };
    if (vad) {
        params.vad = vad;
    }
    return {
        action: ACTIONS.START_SPEECH_RECOGNITION,
        params,
    };
}

export function startSpeechRecognitionWithCustomConfig(
    sessionID: string | number,
    provider: string,
    config: any,
    vad?: VadConfig,
) {
    const params: any = {
        provider,
        customConfig: config,
        sessionID,
    };
    if (vad) {
        params.vad = vad;
    }
    return {
        action: ACTIONS.START_SPEECH_RECOGNITION_CUSTOM,
        params,
    };
}

export function stopSpeechRecognition(sessionID: string | number) {
    return {
        action: ACTIONS.STOP_SPEECH_RECOGNITION,
        params: {
            sessionID,
        },
    };
}
