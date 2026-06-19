import EventEmitter from 'events';
import type ProPBXCall from './call';
import * as actions from './actions';
import { APP_EVENTS, WS_CALL_EVENTS } from './events';
import { Variable } from './types';

export default class ProPBXVariables extends EventEmitter {
    private call: ProPBXCall;
    vars: Array<Variable> = [];

    private _onSet: ((message: any) => void) | null = null;
    private _onGet: ((message: any) => void) | null = null;
    private _onDelete: ((message: any) => void) | null = null;

    constructor(call: ProPBXCall) {
        super();
        this.call = call;
        this.setMaxListeners(200);
        this.initEventHandlers();
    }

    private initEventHandlers(): void {
        this._onSet = (message: any) => {
            if (message.callID !== this.call.id) return;
            this.vars = message.params.variables;
            this.call.emit(APP_EVENTS.VARIABLES_SET, message);
        };
        this._onGet = (message: any) => {
            if (message.callID !== this.call.id) return;
            this.vars = message.params.variables;
            this.call.emit(APP_EVENTS.VARIABLES_GET, message);
        };
        this._onDelete = (message: any) => {
            if (message.callID !== this.call.id) return;
            this.vars = message.params.variables;
            this.call.emit(APP_EVENTS.VARIABLES_DELETE, message);
        };
        this.call.on(WS_CALL_EVENTS.VARIABLES_SET, this._onSet);
        this.call.on(WS_CALL_EVENTS.VARIABLES_GET, this._onGet);
        this.call.on(WS_CALL_EVENTS.VARIABLES_DELETE, this._onDelete);
    }

    destroy(): void {
        if (this._onSet) {
            this.call.off(WS_CALL_EVENTS.VARIABLES_SET, this._onSet);
            this.call.off(WS_CALL_EVENTS.VARIABLES_GET, this._onGet!);
            this.call.off(WS_CALL_EVENTS.VARIABLES_DELETE, this._onDelete!);
            this._onSet = null;
            this._onGet = null;
            this._onDelete = null;
        }
    }

    set(variables: Array<Variable>): void {
        this.call.send(actions.variablesSet(variables));
    }

    delete(name: string): void {
        this.call.send(actions.variablesDelete(name));
    }

    get(): void {
        this.call.send(actions.variablesGet());
    }
}
