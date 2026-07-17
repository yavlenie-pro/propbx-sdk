import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'events';
import ProPBXPlayback from './playback';
import ProPBXRecording from './recording';
import ProPBXSpeechRecognition from './recognition';
import ProPBXVariables from './variables';
import * as actions from './actions';
import { WS_EVENTS } from './events';
import { VadConfig } from './types';

/** Minimal transport surface a call needs to write a control action. */
export interface CallTransport {
    sendAction(data: any): void;
}

export default class ProPBXCall extends EventEmitter {
    id: string;
    private transport: CallTransport;
    params: any;
    isConnected: boolean;
    /**
     * True while the call sits in an active bridge (call-forward answered, bot
     * detached from the media path). A bridged call produces no per-call events
     * for the whole conversation, so the class layer must not GC it by
     * inactivity — otherwise `forwardedCallFinished`/`callFinished` at the end
     * of a long transfer would hit a removed call and be dropped.
     */
    isBridged: boolean;
    variables: ProPBXVariables;

    constructor(id: string = uuidv4(), transport: CallTransport, params: any = {}) {
        super();
        this.id = id;
        this.transport = transport;
        this.params = params;
        this.isConnected = false;
        this.isBridged = false;
        this.setMaxListeners(200);
        this.variables = new ProPBXVariables(this);
    }

    processEvent(event: string, data: any, receiveData: any = null): void {
        this.emit(event, data);
        if (receiveData) {
            this.emit(WS_EVENTS.WS_RECEIVE, receiveData);
        }
    }

    send(data: any): void {
        const dataWithCallID = Object.assign(Object.assign({}, data), { callID: this.id });
        this.emit(WS_EVENTS.WS_SEND, dataWithCallID);
        this.transport.sendAction(dataWithCallID);
    }

    hangup(reason?: any): void {
        this.send(actions.hangup(reason));
    }

    answer(): void {
        this.isConnected = true;
        this.send(actions.answer());
    }

    ring(): void {
        this.send(actions.ring());
    }

    stopDelivery(): void {
        this.send(actions.stopDelivery());
    }

    stopTry(): void {
        this.send(actions.stopTry());
    }

    start(): void {
        this.send(actions.startCall());
    }

    finish(): void {
        this.send(actions.finishCall());
    }

    pong(): void {
        this.send(actions.pong());
    }

    startAudioStream(): void {
        this.send(actions.startAudioStream());
    }

    stopAudioStream(): void {
        this.send(actions.stopAudioStream());
    }

    forwardAudioStream(host: string, port: number | string): void {
        this.send(actions.forwardAudioStream(host, port));
    }

    sendSMS(to: string, text: string, digital: any, short: any, from: string): void {
        this.send(actions.sendSms(to, text, digital ? 1 : 0, short ? 1 : 0, from));
    }

    forward(to: string, message: string, tts: any, headers: any = null): void {
        this.send(actions.callForward(to, message, tts, headers));
    }

    startBackgroundSound(url: string, volume: any, repeat: any): void {
        this.send(actions.startBackgroundSound(url, volume, repeat));
    }

    cacheTTS(phrases: any): void {
        this.send(actions.cacheTTS(phrases));
    }

    stopBackgroundSound(): void {
        this.send(actions.stopBackgroundSound());
    }

    say(text: string, params?: any, ssml?: any): ProPBXPlayback {
        const playback = new ProPBXPlayback(this);
        playback.say(text, params, ssml);
        return playback;
    }

    playURL(url: string): ProPBXPlayback {
        const playback = new ProPBXPlayback(this);
        playback.playURL(url);
        return playback;
    }

    playFile(path: string): ProPBXPlayback {
        const playback = new ProPBXPlayback(this);
        playback.playFile(path);
        return playback;
    }

    startSpeechRecognition({
        provider,
        language,
        grammar,
        timeout,
        vad,
    }: {
        provider: any;
        language: any;
        grammar: any;
        timeout: any;
        vad?: VadConfig;
    }): ProPBXSpeechRecognition {
        const recognitionSession = new ProPBXSpeechRecognition(this);
        recognitionSession.startSpeechRecognition(provider, language, grammar, timeout, vad);
        return recognitionSession;
    }

    startSpeechRecognitionWithCustomConfig({
        provider,
        config,
        vad,
    }: {
        provider: any;
        config: any;
        vad?: VadConfig;
    }): ProPBXSpeechRecognition {
        const recognitionSession = new ProPBXSpeechRecognition(this);
        recognitionSession.startSpeechRecognitionWithCustomConfig(provider, config, vad);
        return recognitionSession;
    }

    stopSpeechRecognition(): ProPBXSpeechRecognition {
        const recognitionSession = new ProPBXSpeechRecognition(this);
        recognitionSession.stopSpeechRecognition();
        return recognitionSession;
    }

    startAudioRecord(format: any): ProPBXRecording {
        const recording = new ProPBXRecording(this);
        recording.startRecording(format);
        return recording;
    }

    reachMarker(blockId: number, name: string): void {
        this.send(actions.reachMarker(blockId, name));
    }
}
