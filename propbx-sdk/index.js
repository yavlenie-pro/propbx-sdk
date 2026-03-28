"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const events_1 = __importDefault(require("events"));
const ws_1 = __importDefault(require("ws"));
const call_1 = __importDefault(require("./call"));
const events_2 = require("./events");
const actions_1 = require("./actions");
class ProPBX extends events_1.default {
    constructor(config, maxCallTimeout = 5 * 60 * 1000, maxListeners = 200, reconnectTimeout = 500, pingTimeout = 60000, pingInterval = 5000, pingEnable = false) {
        super();
        this.config = config;
        this.maxCallTimeout = maxCallTimeout;
        this.maxListeners = maxListeners;
        this.reconnectTimeout = reconnectTimeout;
        this.pingTimeout = pingTimeout;
        this.pingInterval = pingInterval;
        this.pingEnable = pingEnable;
        this.calls = {};
        this.callTimers = {};
        this.setMaxListeners(maxListeners);
        this.pingEnable = this.config.pingEnable;
    }
    start() {
        this.connect();
        return this;
    }
    send(data) {
        if (this.ws && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }
    handleWsMessage(messageData) {
        const message = JSON.parse(messageData);
        const { event } = message;
        switch (event) {
            case events_2.WS_EVENTS.AUTH_OK:
                this.emit(events_2.APP_EVENTS.CONNECTED);
                break;
            case events_2.WS_EVENTS.AUTH_FAIL:
                this.emit(events_2.APP_EVENTS.AUTH_FAIL);
                break;
            case events_2.WS_EVENTS.FILE_STORED:
                this.emit(events_2.APP_EVENTS.FILE_STORED, message);
                break;
            case events_2.WS_EVENTS.FILE_STORE_ERROR:
                this.emit(events_2.APP_EVENTS.FILE_STORE_ERROR, message);
                break;
            default:
                this.handleCallWsMessage(message);
        }
    }
    handleCallWsMessage(message) {
        const { event } = message;
        let call = this.getCall(message.callID);
        if (!call) {
            call = new call_1.default(message.callID, this.ws, message.params);
            this.calls[message.callID] = call;
        }
        if (event === events_2.WS_EVENTS.ERROR) {
            this.emit(events_2.APP_EVENTS.BOT_ERROR, call);
            call.processEvent(events_2.APP_EVENTS.BOT_ERROR, message.params, message);
            return;
        }
        if (event === events_2.WS_EVENTS.CALL_DISCONNECTED) {
            call.isConnected = false;
            this.emit(event, call, message.params);
            call.processEvent(events_2.APP_EVENTS.CALL_DISCONNECTED, message.params, message);
            this.removeCall(message.callID);
            return;
        }
        this.emit(event, call, message.params);
        call.processEvent(event, message.params, message);
        if (event === events_2.WS_EVENTS.PING)
            call.pong();
    }
    connect() {
        this.ws = new ws_1.default(this.config.url);
        this.ws.on('open', () => {
            this.send(actions_1.auth(this.config.appId, this.config.key));
            if (this.pingEnable) {
                this._pingInterval = setInterval(() => {
                    this.ws.ping();
                }, this.pingInterval);
                this.timeout();
            }
        });
        this.ws.on('message', this.handleWsMessage.bind(this));
        this.ws.on('close', this.reconnect.bind(this));
        this.ws.on('error', this.reconnect.bind(this));
        this.ws.on('ping', this.ping.bind(this));
        this.ws.on('pong', this.pong.bind(this));
    }
    timeout() {
        if (this._pingTimeout) {
            clearTimeout(this._pingTimeout);
        }
        this._pingTimeout = setTimeout(() => {
            this.reconnect();
        }, this.pingTimeout);
    }
    ping() {
        this.emit(events_2.WS_EVENTS.WS_PING);
    }
    pong() {
        this.timeout();
        this.emit(events_2.WS_EVENTS.WS_PONG);
    }
    reconnect() {
        if (this.pingEnable) {
            clearInterval(this._pingInterval);
            clearInterval(this._pingTimeout);
        }
        this.emit(events_2.WS_EVENTS.RECONNECT);
        if (this.ws) {
            this.ws.removeAllListeners();
        }
        for (const callId of Object.keys(this.calls)) {
            this.removeCall(callId);
        }
        if (this.config.disableReconnect !== true) {
            setTimeout(() => this.connect(), this.reconnectTimeout);
        }
    }
    stopApp() {
        if (this.ws) {
            this.ws.send(JSON.stringify({
                action: actions_1.ACTIONS.STOP_APP,
            }));
        }
    }
    getCallsCount() {
        return Object.keys(this.calls).length;
    }
    getCall(callId) {
        const call = this.calls[callId];
        if (!call)
            return undefined;
        this.touchCall(callId);
        return call;
    }
    removeCall(callId) {
        if (this.callTimers[callId]) {
            clearTimeout(this.callTimers[callId]);
            delete this.callTimers[callId];
        }
        if (this.calls[callId]) {
            this.calls[callId].removeAllListeners();
            delete this.calls[callId];
            return true;
        }
        return false;
    }
    makeCall(to, opts) {
        const callID = uuid_1.v1();
        const call = new call_1.default(callID, this.ws);
        this.calls[callID] = call;
        this.touchCall(callID);
        const params = Object.assign(Object.assign({}, opts), { appID: this.config.appId, callID });
        this.send(actions_1.makeCall({ to, params }));
        return call;
    }
    touchCall(callId) {
        if (this.callTimers[callId]) {
            clearTimeout(this.callTimers[callId]);
        }
        this.callTimers[callId] = setTimeout(this.removeCall.bind(this), this.maxCallTimeout, callId);
    }
}
exports.default = ProPBX;
//# sourceMappingURL=index.js.map