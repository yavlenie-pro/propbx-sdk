/// <reference types="node" />
import EventEmitter from 'events';
import WebSocket from 'ws';
import InfobotCall from './call';
import { InfobotConfig } from './types';
export default class ProPBX extends EventEmitter {
    private config;
    maxCallTimeout: number;
    maxListeners: number;
    reconnectTimeout: number;
    pingTimeout: number;
    pingInterval: number;
    pingEnable: boolean;
    ws: WebSocket;
    calls: Record<string, InfobotCall>;
    private _pingInterval;
    private _pingTimeout;
    private callTimers;
    constructor(config: InfobotConfig, maxCallTimeout?: number, maxListeners?: number, reconnectTimeout?: number, pingTimeout?: number, pingInterval?: number, pingEnable?: boolean);
    start(): this;
    private send;
    private handleWsMessage;
    private handleCallWsMessage;
    private connect;
    private timeout;
    private ping;
    private pong;
    private reconnect;
    stopApp(): void;
    getCallsCount(): number;
    getCall(callId: string): InfobotCall;
    removeCall(callId: string): boolean;
    makeCall(to: any, opts: any): InfobotCall;
    private touchCall;
}
