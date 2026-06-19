/**
 * Event-name constant maps. The string VALUES are the public wire/event names and
 * are identical to the legacy v1 SDK — do not change them. Only the transport
 * underneath changed (WebSocket -> gRPC); the names bots listen for did not.
 */

export const WS_EVENTS = {
    WS_SEND: 'wsSend',
    WS_RECEIVE: 'wsReceive',
    ERROR: 'error',
    AUTH_OK: 'auth-ok',
    AUTH_FAIL: 'auth-fail',
    FILE_REQUEST: 'file-request',
    FILE_STORED: 'file-stored',
    FILE_STORE_ERROR: 'file-store-error',
    CALL_DISCONNECTED: 'call-disconnected',
    CALL_FINISHED: 'callFinished',
    CACHE_TTS_READY: 'cacheTTSReady',
    PING: 'ping',
    RECONNECT: 'reconnect',
    WS_PING: 'wsPing',
    WS_PONG: 'wsPong',
} as const;

export const APP_EVENTS = {
    AUTH_FAIL: 'AUTH_FAIL',
    BOT_ERROR: 'botError',
    DISCONNECTED: 'disconnected',
    FILE_REQUEST: 'FILE_REQUEST',
    FILE_STORED: 'FILE_STORED',
    FILE_STORE_ERROR: 'FILE_STORE_ERROR',
    CONNECTED: 'connected',
    RECORDING_FAILED: 'recordingFailed',
    RECORDING_COMPLETE: 'recordingComplete',
    RECORDING_SESSION_NOT_FOUND: 'recordingSessionNotFound',
    CALL_DISCONNECTED: 'call-disconnected',
    CALL_FINISHED: 'callFinished',
    PLAYBACK_FINISHED: 'playbackFinished',
    SPEECH_RECOGNITION_TIMEOUT: 'speech-recognition-timeout',
    SPEECH_RECOGNITION_EOU: 'speech-recognition-eou',
    TRANSCRIBE: 'transcribe',
    VARIABLES_SET: 'variables-set',
    VARIABLES_DELETE: 'variables-delete',
    VARIABLES_GET: 'variables-get',
} as const;

export const WS_CALL_EVENTS = {
    BOT_ERROR: 'botError',
    RECORDING_SESSION_NOT_FOUND: 'recordingSessionNotFound',
    RECORDING_FAILED: 'recordingFailed',
    RECORDING_COMPLETE: 'recordingComplete',
    TRANSCRIBE: 'transcribe',
    SPEECH_RECOGNITION_TIMEOUT: 'speech-recognition-timeout',
    SPEECH_RECOGNITION_EOU: 'speech-recognition-eou',
    PLAYBACK_FINISHED: 'playbackFinished',
    CALL_DISCONNECTED: 'call-disconnected',
    CALL_FINISHED: 'callFinished',
    VARIABLES_SET: 'variables-set',
    VARIABLES_DELETE: 'variables-delete',
    VARIABLES_GET: 'variables-get',
} as const;
