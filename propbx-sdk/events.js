"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WS_CALL_EVENTS = exports.APP_EVENTS = exports.WS_EVENTS = void 0;
exports.WS_EVENTS = {
    WS_SEND: 'wsSend',
    WS_RECEIVE: 'wsReceive',
    ERROR: 'error',
    AUTH_OK: 'auth-ok',
    AUTH_FAIL: 'auth-fail',
    FILE_REQUEST: 'file-request',
    FILE_STORED: 'file-stored',
    FILE_STORE_ERROR: 'file-store-error',
    CALL_DISCONNECTED: 'call-disconnected',
    PING: 'ping',
    RECONNECT: 'reconnect',
    WS_PING: 'wsPing',
    WS_PONG: 'wsPong',
};
exports.APP_EVENTS = {
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
    PLAYBACK_FINISHED: 'playbackFinished',
    SPEECH_RECOGNITION_TIMEOUT: 'speech-recognition-timeout',
    TRANSCRIBE: 'transcribe',
    VARIABLES_SET: 'variables-set',
    VARIABLES_DELETE: 'variables-delete',
    VARIABLES_GET: 'variables-get',
};
exports.WS_CALL_EVENTS = {
    BOT_ERROR: 'botError',
    RECORDING_SESSION_NOT_FOUND: 'recordingSessionNotFound',
    RECORDING_FAILED: 'recordingFailed',
    RECORDING_COMPLETE: 'recordingComplete',
    TRANSCRIBE: 'transcribe',
    SPEECH_RECOGNITION_TIMEOUT: 'speech-recognition-timeout',
    PLAYBACK_FINISHED: 'playbackFinished',
    CALL_DISCONNECTED: 'call-disconnected',
    VARIABLES_SET: 'variables-set',
    VARIABLES_DELETE: 'variables-delete',
    VARIABLES_GET: 'variables-get',
};
//# sourceMappingURL=events.js.map