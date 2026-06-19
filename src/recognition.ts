import { v4 as uuidv4 } from 'uuid';
import EventEmitter from 'events';
import type ProPBXCall from './call';
import { APP_EVENTS, WS_CALL_EVENTS } from './events';
import * as actions from './actions';
import { VadConfig } from './types';

export default class ProPBXSpeechRecognition extends EventEmitter {
    private call: ProPBXCall;
    id: string;

    private _onTimeout: ((message: any) => void) | null = null;
    private _onTranscribe: ((message: any) => void) | null = null;
    private _onEou: ((message: any) => void) | null = null;

    constructor(call: ProPBXCall) {
        super();
        this.call = call;
        this.id = uuidv4();
        this.setMaxListeners(200);
        this.initEventHandlers();
    }

    initEventHandlers(): void {
        this._onTimeout = (message: any) => {
            if (message.sessionID !== this.id) return;
            this.emit(APP_EVENTS.SPEECH_RECOGNITION_TIMEOUT, message);
            this.destroy();
        };
        this._onTranscribe = (message: any) => {
            if (message.sessionID !== this.id) return;
            this.emit(APP_EVENTS.TRANSCRIBE, message);
        };
        this._onEou = (message: any) => {
            if (message.sessionID !== this.id) return;
            this.emit(APP_EVENTS.SPEECH_RECOGNITION_EOU, message);
            this.destroy();
        };
        this.call.on(WS_CALL_EVENTS.SPEECH_RECOGNITION_TIMEOUT, this._onTimeout);
        this.call.on(WS_CALL_EVENTS.TRANSCRIBE, this._onTranscribe);
        this.call.on(WS_CALL_EVENTS.SPEECH_RECOGNITION_EOU, this._onEou);
    }

    destroy(): void {
        if (this._onTimeout) {
            this.call.off(WS_CALL_EVENTS.SPEECH_RECOGNITION_TIMEOUT, this._onTimeout);
            this.call.off(WS_CALL_EVENTS.TRANSCRIBE, this._onTranscribe!);
            this.call.off(WS_CALL_EVENTS.SPEECH_RECOGNITION_EOU, this._onEou!);
            this._onTimeout = null;
            this._onTranscribe = null;
            this._onEou = null;
        }
    }

    startSpeechRecognition(provider: any, language: any, grammar: any, timeout: any, vad?: VadConfig): this {
        this.call.send(actions.startSpeechRecognition(this.id, provider, language, grammar, timeout, vad));
        return this;
    }

    startSpeechRecognitionWithCustomConfig(provider: string, config: any, vad?: VadConfig): this {
        this.call.send(actions.startSpeechRecognitionWithCustomConfig(this.id, provider, config, vad));
        return this;
    }

    stopSpeechRecognition(): this {
        this.call.send(actions.stopSpeechRecognition(this.id));
        return this;
    }
}
