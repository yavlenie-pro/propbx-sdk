import EventEmitter from 'events';
import { v1 as uuidv1 } from 'uuid';
import type ProPBXCall from './call';
import * as actions from './actions';
import { APP_EVENTS, WS_CALL_EVENTS } from './events';

export default class ProPBXRecording extends EventEmitter {
    private call: ProPBXCall;
    id: string;

    private _onComplete: ((message: any) => void) | null = null;
    private _onFailed: ((message: any) => void) | null = null;
    private _onNotFound: ((message: any) => void) | null = null;
    private _onBotError: ((message: any) => void) | null = null;

    constructor(call: ProPBXCall) {
        super();
        this.call = call;
        this.id = uuidv1();
        this.setMaxListeners(200);
        this.initEventHandlers();
    }

    private initEventHandlers(): void {
        this._onComplete = (message: any) => {
            if (message.recordingID !== this.id) return;
            this.emit(APP_EVENTS.RECORDING_COMPLETE, message);
            this.destroy();
        };
        this._onFailed = (message: any) => {
            if (message.recordingID !== this.id) return;
            this.emit(APP_EVENTS.RECORDING_FAILED, message);
            this.destroy();
        };
        this._onNotFound = (message: any) => {
            if (message.recordingID !== this.id) return;
            this.emit(APP_EVENTS.RECORDING_SESSION_NOT_FOUND, message);
            this.destroy();
        };
        this._onBotError = (message: any) => {
            if (message.recordingID !== this.id) return;
            this.emit(APP_EVENTS.BOT_ERROR, message);
            this.destroy();
        };
        this.call.on(WS_CALL_EVENTS.RECORDING_COMPLETE, this._onComplete);
        this.call.on(WS_CALL_EVENTS.RECORDING_FAILED, this._onFailed);
        this.call.on(WS_CALL_EVENTS.RECORDING_SESSION_NOT_FOUND, this._onNotFound);
        this.call.on(WS_CALL_EVENTS.BOT_ERROR, this._onBotError);
    }

    destroy(): void {
        if (this._onComplete) {
            this.call.off(WS_CALL_EVENTS.RECORDING_COMPLETE, this._onComplete);
            this.call.off(WS_CALL_EVENTS.RECORDING_FAILED, this._onFailed!);
            this.call.off(WS_CALL_EVENTS.RECORDING_SESSION_NOT_FOUND, this._onNotFound!);
            this.call.off(WS_CALL_EVENTS.BOT_ERROR, this._onBotError!);
            this._onComplete = null;
            this._onFailed = null;
            this._onNotFound = null;
            this._onBotError = null;
        }
    }

    startRecording(format: any): this {
        this.call.send(actions.startAudioRecord(this.id, format));
        return this;
    }

    stopRecording(): this {
        this.call.send(actions.stopAudioRecord(this.id));
        return this;
    }
}
