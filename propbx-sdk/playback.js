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
const fs_1 = __importDefault(require("fs"));
const md5_1 = __importDefault(require("md5"));
const mime_1 = __importDefault(require("mime"));
const uuid_1 = require("uuid");
const events_1 = __importDefault(require("events"));
const events_2 = require("./events");
const actions = __importStar(require("./actions"));
class ProPBXPlayback extends events_1.default {
    constructor(call) {
        super();
        this.call = call;
        this.id = uuid_1.v1();
        this.setMaxListeners(200);
        this.initEventHandlders();
    }
    initEventHandlders() {
        this._onDisconnected = (message) => {
            if (this.call.id !== message.callID)
                return;
            this.emit(events_2.APP_EVENTS.CALL_DISCONNECTED, message);
            this.destroy();
        };
        this._onPlaybackFinished = (message) => {
            if (message.playbackID !== this.id)
                return;
            this.emit(events_2.APP_EVENTS.PLAYBACK_FINISHED, message);
            this.destroy();
        };
        this._onBotError = (message) => {
            if (message.playbackID !== this.id)
                return;
            this.emit(events_2.APP_EVENTS.BOT_ERROR, message);
            this.destroy();
        };
        this.call.on(events_2.WS_CALL_EVENTS.CALL_DISCONNECTED, this._onDisconnected);
        this.call.on(events_2.WS_CALL_EVENTS.PLAYBACK_FINISHED, this._onPlaybackFinished);
        this.call.on(events_2.WS_CALL_EVENTS.BOT_ERROR, this._onBotError);
    }
    destroy() {
        if (this._onDisconnected) {
            this.call.off(events_2.WS_CALL_EVENTS.CALL_DISCONNECTED, this._onDisconnected);
            this.call.off(events_2.WS_CALL_EVENTS.PLAYBACK_FINISHED, this._onPlaybackFinished);
            this.call.off(events_2.WS_CALL_EVENTS.BOT_ERROR, this._onBotError);
            this._onDisconnected = null;
            this._onPlaybackFinished = null;
            this._onBotError = null;
        }
    }
    say(text, params, ssml) {
        this.call.send(actions.ttsAction(this.id, text, params, ssml));
        return this;
    }
    playURL(url) {
        this.call.send(actions.playbackAction(this.id, url));
        return this;
    }
    playFile(path) {
        fs_1.default.promises.readFile(path).then((file) => {
            const fileHash = md5_1.default(file);
            const fileType = mime_1.default.getType(path);
            const processFileRequest = (requestFileHash) => {
                if (fileHash !== requestFileHash.fileHash)
                    return false;
                const fileData = file.toString('base64');
                this.call.send(actions.fileResponse(this.id, fileData, fileType));
            };
            this.call.send(actions.playbackFile(this.id, fileHash, fileType));
            this.call.once(events_2.WS_EVENTS.FILE_REQUEST, processFileRequest);
            setTimeout(() => {
                this.call.off(events_2.WS_EVENTS.FILE_REQUEST, processFileRequest);
            }, 20000);
        });
        return this;
    }
    stop() {
        this.call.send(actions.stopPlayback(this.id));
        return this;
    }
}
exports.default = ProPBXPlayback;
//# sourceMappingURL=playback.js.map