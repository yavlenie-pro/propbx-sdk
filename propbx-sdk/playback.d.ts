/// <reference types="node" />
import EventEmitter from 'events';
import InfobotCall from './call';
export default class ProPBXPlayback extends EventEmitter {
    call: InfobotCall;
    id: string;
    constructor(call: InfobotCall);
    private initEventHandlders;
    say(text: any, params: any, ssml: any): this;
    playURL(url: string): this;
    playFile(path: string): this;
    stop(): this;
}
