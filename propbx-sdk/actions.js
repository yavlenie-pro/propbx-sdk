"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopSpeechRecognition = exports.startSpeechRecognitionWithCustomConfig = exports.startSpeechRecognition = exports.stopPlayback = exports.fileResponse = exports.playbackFile = exports.playbackAction = exports.ttsAction = exports.stopAudioRecord = exports.startAudioRecord = exports.stopBackgroundSound = exports.cacheTTS = exports.startBackgroundSound = exports.callForward = exports.sendSms = exports.forwardAudioStream = exports.stopAudioStream = exports.startAudioStream = exports.pong = exports.finishCall = exports.startCall = exports.stopTry = exports.stopDelivery = exports.ring = exports.answer = exports.hangup = exports.makeCall = exports.auth = exports.reachMarker = exports.variablesDelete = exports.variablesSet = exports.variablesGet = exports.ACTIONS = void 0;
const uuid_1 = require("uuid");
exports.ACTIONS = {
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
};
function variablesGet() {
    return { action: exports.ACTIONS.VARIABLES_GET };
}
exports.variablesGet = variablesGet;
function variablesSet(variables) {
    return { action: exports.ACTIONS.VARIABLES_SET, params: { variables } };
}
exports.variablesSet = variablesSet;
function variablesDelete(name) {
    return { action: exports.ACTIONS.VARIABLES_DELETE, params: { name } };
}
exports.variablesDelete = variablesDelete;
function reachMarker(blockId, name) {
    return { action: exports.ACTIONS.REACH_MARKER, params: { blockId, name } };
}
exports.reachMarker = reachMarker;
function auth(appID, key) {
    return { action: exports.ACTIONS.AUTH, appID, key };
}
exports.auth = auth;
function makeCall(params = {}) {
    return Object.assign({ action: exports.ACTIONS.MAKE_CALL }, params);
}
exports.makeCall = makeCall;
function hangup(reason) {
    return {
        action: exports.ACTIONS.HANGUP,
        params: {
            reason: reason,
        },
    };
}
exports.hangup = hangup;
function answer() {
    return { action: exports.ACTIONS.ANSWER };
}
exports.answer = answer;
function ring() {
    return { action: exports.ACTIONS.RING };
}
exports.ring = ring;
function stopDelivery(params = {}) {
    return { action: exports.ACTIONS.STOP_DELIVERY, params };
}
exports.stopDelivery = stopDelivery;
function stopTry() {
    return { action: exports.ACTIONS.STOP_TRY };
}
exports.stopTry = stopTry;
function startCall(params = {}) {
    return { action: exports.ACTIONS.START_CALL, params };
}
exports.startCall = startCall;
function finishCall(params = {}) {
    return { action: exports.ACTIONS.FINISH_CALL, params };
}
exports.finishCall = finishCall;
function pong() {
    return { action: exports.ACTIONS.PONG };
}
exports.pong = pong;
function startAudioStream() {
    return { action: exports.ACTIONS.START_AUDIO_STREAM };
}
exports.startAudioStream = startAudioStream;
function stopAudioStream() {
    return { action: exports.ACTIONS.STOP_AUDIO_STREAM };
}
exports.stopAudioStream = stopAudioStream;
function forwardAudioStream(host, port) {
    return {
        action: exports.ACTIONS.FORWARD_AUDIO_STREAM,
        params: { host, port },
    };
}
exports.forwardAudioStream = forwardAudioStream;
function sendSms(to, text, digital, short, from, id) {
    return { action: exports.ACTIONS.SEND_SMS, to, text, from, digital, short, id: id || uuid_1.v1() };
}
exports.sendSms = sendSms;
function callForward(to, message, tts, headers = null) {
    return {
        action: exports.ACTIONS.CALL_FORWARD,
        params: { to, message, tts, headers },
    };
}
exports.callForward = callForward;
function startBackgroundSound(url, volume, repeat) {
    return {
        action: exports.ACTIONS.START_BACKGROUND_SOUND,
        params: {
            url,
            repeat,
            volume,
        },
    };
}
exports.startBackgroundSound = startBackgroundSound;
function cacheTTS(phrases) {
    return {
        action: exports.ACTIONS.CACHE_TTS,
        params: {
            phrases: phrases,
        },
    };
}
exports.cacheTTS = cacheTTS;
function stopBackgroundSound() {
    return { action: exports.ACTIONS.STOP_BACKGROUND_SOUND };
}
exports.stopBackgroundSound = stopBackgroundSound;
function startAudioRecord(recordingID, format) {
    return {
        action: exports.ACTIONS.START_AUDIO_RECORD,
        params: {
            format,
            recordingID,
        },
    };
}
exports.startAudioRecord = startAudioRecord;
function stopAudioRecord(recordingID) {
    return {
        action: exports.ACTIONS.STOP_AUDIO_RECORD,
        params: {
            recordingID,
        },
    };
}
exports.stopAudioRecord = stopAudioRecord;
function ttsAction(playbackID, text, params = {}, ssml) {
    return {
        action: exports.ACTIONS.TTS_ACTION,
        params: Object.assign(Object.assign({ text,
            ssml,
            playbackID }, params)),
    };
}
exports.ttsAction = ttsAction;
function playbackAction(playbackID, url) {
    return {
        action: exports.ACTIONS.PLAYBACK_ACTION,
        params: { url, playbackID },
    };
}
exports.playbackAction = playbackAction;
function playbackFile(playbackID, fileHash, fileType) {
    return {
        action: exports.ACTIONS.PLAYBACK_FILE,
        params: { fileHash, fileType, playbackID },
    };
}
exports.playbackFile = playbackFile;
function fileResponse(playbackID, fileData, fileType) {
    return {
        action: exports.ACTIONS.FILE_RESPONSE,
        params: { fileData, fileType, playbackID },
    };
}
exports.fileResponse = fileResponse;
function stopPlayback(playbackID) {
    return {
        action: exports.ACTIONS.STOP_PLAYBACK,
        params: {
            playbackID,
        },
    };
}
exports.stopPlayback = stopPlayback;
function startSpeechRecognition(sessionID, provider, language, grammar, timeout) {
    return {
        action: exports.ACTIONS.START_SPEECH_RECOGNITION,
        params: {
            provider,
            language,
            grammar,
            timeout,
            sessionID,
        },
    };
}
exports.startSpeechRecognition = startSpeechRecognition;
function startSpeechRecognitionWithCustomConfig(sessionID, provider, config) {
    return {
        action: exports.ACTIONS.START_SPEECH_RECOGNITION_CUSTOM,
        params: {
            provider,
            customConfig: config,
            sessionID,
        },
    };
}
exports.startSpeechRecognitionWithCustomConfig = startSpeechRecognitionWithCustomConfig;
function stopSpeechRecognition(sessionID) {
    return {
        action: exports.ACTIONS.STOP_SPEECH_RECOGNITION,
        params: {
            sessionID,
        },
    };
}
exports.stopSpeechRecognition = stopSpeechRecognition;
//# sourceMappingURL=actions.js.map