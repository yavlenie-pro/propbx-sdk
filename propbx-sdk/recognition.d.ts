/// <reference types="node" />
import EventEmitter from 'events';
import InfobotCall from './call';
import { VadConfig } from './types';
export default class ProPBXSpeechRecognition extends EventEmitter {
    private call;
    id: string;
    constructor(call: InfobotCall);
    initEventHandlers(): void;
    startSpeechRecognition(provider: any, language: any, grammar: any, timeout: any, vad?: VadConfig): this;
    startSpeechRecognitionWithCustomConfig(provider: string, config: any, vad?: VadConfig): this;
    stopSpeechRecognition(): this;
}
