/// <reference types="node" />
import EventEmitter from 'events';
import InfobotCall from './call';
import { Variable } from './types';
export default class ProPBXVariables extends EventEmitter {
    private call;
    vars: Array<Variable>;
    constructor(call: InfobotCall);
    private initEventHandlers;
    set(variables: Array<Variable>): void;
    delete(name: string): void;
    get(): void;
}
