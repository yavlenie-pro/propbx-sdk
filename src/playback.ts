import fs from 'fs';
import md5 from 'md5';
import mime from 'mime';
import { v1 as uuidv1 } from 'uuid';
import EventEmitter from 'events';
import type ProPBXCall from './call';
import { APP_EVENTS, WS_CALL_EVENTS, WS_EVENTS } from './events';
import * as actions from './actions';

export default class ProPBXPlayback extends EventEmitter {
    call: ProPBXCall;
    id: string;

    private _onDisconnected: ((message: any) => void) | null = null;
    private _onPlaybackFinished: ((message: any) => void) | null = null;
    private _onBotError: ((message: any) => void) | null = null;

    constructor(call: ProPBXCall) {
        super();
        this.call = call;
        this.id = uuidv1();
        this.setMaxListeners(200);
        this.initEventHandlders();
    }

    private initEventHandlders(): void {
        this._onDisconnected = (message: any) => {
            if (this.call.id !== message.callID) return;
            this.emit(APP_EVENTS.CALL_DISCONNECTED, message);
            this.destroy();
        };
        this._onPlaybackFinished = (message: any) => {
            if (message.playbackID !== this.id) return;
            this.emit(APP_EVENTS.PLAYBACK_FINISHED, message);
            this.destroy();
        };
        this._onBotError = (message: any) => {
            if (message.playbackID !== this.id) return;
            this.emit(APP_EVENTS.BOT_ERROR, message);
            this.destroy();
        };
        this.call.on(WS_CALL_EVENTS.CALL_DISCONNECTED, this._onDisconnected);
        this.call.on(WS_CALL_EVENTS.PLAYBACK_FINISHED, this._onPlaybackFinished);
        this.call.on(WS_CALL_EVENTS.BOT_ERROR, this._onBotError);
    }

    destroy(): void {
        if (this._onDisconnected) {
            this.call.off(WS_CALL_EVENTS.CALL_DISCONNECTED, this._onDisconnected);
            this.call.off(WS_CALL_EVENTS.PLAYBACK_FINISHED, this._onPlaybackFinished!);
            this.call.off(WS_CALL_EVENTS.BOT_ERROR, this._onBotError!);
            this._onDisconnected = null;
            this._onPlaybackFinished = null;
            this._onBotError = null;
        }
    }

    say(text: string, params?: any, ssml?: any): this {
        this.call.send(actions.ttsAction(this.id, text, params, ssml));
        return this;
    }

    playURL(url: string): this {
        this.call.send(actions.playbackAction(this.id, url));
        return this;
    }

    playFile(path: string): this {
        fs.promises.readFile(path).then((file) => {
            const fileHash = md5(file);
            const fileType = mime.getType(path);
            const processFileRequest = (requestFileHash: any) => {
                if (fileHash !== requestFileHash.fileHash) return false;
                const fileData = file.toString('base64');
                this.call.send(actions.fileResponse(this.id, fileData, fileType));
            };
            this.call.send(actions.playbackFile(this.id, fileHash, fileType));
            this.call.once(WS_EVENTS.FILE_REQUEST, processFileRequest);
            setTimeout(() => {
                this.call.off(WS_EVENTS.FILE_REQUEST, processFileRequest);
            }, 20000);
        });
        return this;
    }

    stop(): this {
        this.call.send(actions.stopPlayback(this.id));
        return this;
    }
}
