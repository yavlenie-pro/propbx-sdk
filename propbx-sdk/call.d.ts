/// <reference types="node" />
import WebSocket from 'ws';
import EventEmitter from 'events';
import InfobotPlayback from './playback';
import InfobotRecording from './recording';
import InfobotRecognitionSession from './recognition';
import InfobotVariables from './variables';
export default class ProPBXCall extends EventEmitter {
    id: string;
    private ws;
    params: any;
    isConnected: boolean;
    variables: InfobotVariables;
    constructor(id: string, ws: WebSocket, params?: any);
    processEvent(event: string, data: any, receiveData?: any): void;
    send(data: any): void;
    hangup(reason: any): void;
    answer(): void;
    ring(): void;
    stopDelivery(): void;
    stopTry(): void;
    start(): void;
    finish(): void;
    pong(): void;
    startAudioStream(): void;
    stopAudioStream(): void;
    forwardAudioStream(host: string, port: number | string): void;
    sendSMS(to: string, text: string, digital: any, short: any, from: string): void;
    forward(to: string, message: string, tts: any, headers?: any): void;
    startBackgroundSound(url: string, volume: any, repeat: any): void;
    cacheTTS(phrases: any): void;
    stopBackgroundSound(): void;
    say(text: string, params: any, ssml: any): InfobotPlayback;
    playURL(url: string): InfobotPlayback;
    playFile(path: string): InfobotPlayback;
    startSpeechRecognition({ provider, language, grammar, timeout }: {
        provider: any;
        language: any;
        grammar: any;
        timeout: any;
    }): InfobotRecognitionSession;
    startSpeechRecognitionWithCustomConfig({ provider, config }: {
        provider: any;
        config: any;
    }): InfobotRecognitionSession;
    stopSpeechRecognition(): InfobotRecognitionSession;
    startAudioRecord(format: any): InfobotRecording;
    reachMarker(blockId: number, name: string): void;
}
