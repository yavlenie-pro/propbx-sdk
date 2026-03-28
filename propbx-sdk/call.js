"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const events_1 = __importDefault(require("events"));
const playback_1 = __importDefault(require("./playback"));
const recording_1 = __importDefault(require("./recording"));
const recognition_1 = __importDefault(require("./recognition"));
const actions = __importStar(require("./actions"));
const events_2 = require("./events");
const variables_1 = __importDefault(require("./variables"));
class ProPBXCall extends events_1.default {
    constructor(id = uuid_1.v4(), ws, params = {}) {
        super();
        this.id = id;
        this.ws = ws;
        this.params = params;
        this.isConnected = false;
        this.setMaxListeners(200);
        this.variables = new variables_1.default(this);
    }
    processEvent(event, data, receiveData = null) {
        this.emit(event, data);
        if (receiveData) {
            this.emit(events_2.WS_EVENTS.WS_RECEIVE, receiveData);
        }
    }
    send(data) {
        const dataWithCallID = Object.assign(Object.assign({}, data), { callID: this.id });
        this.emit(events_2.WS_EVENTS.WS_SEND, dataWithCallID);
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(dataWithCallID));
        }
    }
    hangup(reason) {
        this.send(actions.hangup(reason));
    }
    answer() {
        this.isConnected = true;
        this.send(actions.answer());
    }
    ring() {
        this.send(actions.ring());
    }
    stopDelivery() {
        this.send(actions.stopDelivery());
    }
    stopTry() {
        this.send(actions.stopTry());
    }
    start() {
        this.send(actions.startCall());
    }
    finish() {
        this.send(actions.finishCall());
    }
    pong() {
        this.send(actions.pong());
    }
    startAudioStream() {
        this.send(actions.startAudioStream());
    }
    stopAudioStream() {
        this.send(actions.stopAudioStream());
    }
    forwardAudioStream(host, port) {
        this.send(actions.forwardAudioStream(host, port));
    }
    sendSMS(to, text, digital, short, from) {
        this.send(actions.sendSms(to, text, digital ? 1 : 0, short ? 1 : 0, from));
    }
    forward(to, message, tts, headers = null) {
        this.send(actions.callForward(to, message, tts, headers));
    }
    startBackgroundSound(url, volume, repeat) {
        this.send(actions.startBackgroundSound(url, volume, repeat));
    }
    cacheTTS(phrases) {
        this.send(actions.cacheTTS(phrases));
    }
    stopBackgroundSound() {
        this.send(actions.stopBackgroundSound());
    }
    say(text, params, ssml) {
        const playback = new playback_1.default(this);
        playback.say(text, params, ssml);
        return playback;
    }
    playURL(url) {
        const playback = new playback_1.default(this);
        playback.playURL(url);
        return playback;
    }
    playFile(path) {
        const playback = new playback_1.default(this);
        playback.playFile(path);
        return playback;
    }
    startSpeechRecognition({ provider, language, grammar, timeout }) {
        const recognitionSession = new recognition_1.default(this);
        recognitionSession.startSpeechRecognition(provider, language, grammar, timeout);
        return recognitionSession;
    }
    startSpeechRecognitionWithCustomConfig({ provider, config }) {
        const recognitionSession = new recognition_1.default(this);
        recognitionSession.startSpeechRecognitionWithCustomConfig(provider, config);
        return recognitionSession;
    }
    stopSpeechRecognition() {
        const recognitionSession = new recognition_1.default(this);
        recognitionSession.stopSpeechRecognition();
        return recognitionSession;
    }
    startAudioRecord(format) {
        const recording = new recording_1.default(this);
        recording.startRecording(format);
        return recording;
    }
    reachMarker(blockId, name) {
        this.send(actions.reachMarker(blockId, name));
    }
}
exports.default = ProPBXCall;
//# sourceMappingURL=call.js.map