/// <reference types="node" />
import EventEmitter from 'events';
import InfobotCall from './call';
export default class ProPBXSpeechRecognition extends EventEmitter {
    private call;
    id: string;
    constructor(call: InfobotCall);
    initEventHandlers(): void;
    startSpeechRecognition(provider: any, language: any, grammar: any, timeout: any): this;
    startSpeechRecognitionWithCustomConfig(provider: string, config: any): this;
    stopSpeechRecognition(): this;
}
