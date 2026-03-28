"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
const actions_1 = require("./actions");
const events_2 = require("./events");
class ProPBXVariables extends events_1.default {
    constructor(call) {
        super();
        this.call = call;
        //id: string = uuid()
        this.vars = [];
        this.setMaxListeners(200);
        this.initEventHandlers();
    }
    initEventHandlers() {
        this._onSet = (message) => {
            if (message.callID !== this.call.id)
                return;
            this.vars = message.params.variables;
            this.call.emit(events_2.APP_EVENTS.VARIABLES_SET, message);
        };
        this._onGet = (message) => {
            if (message.callID !== this.call.id)
                return;
            this.vars = message.params.variables;
            this.call.emit(events_2.APP_EVENTS.VARIABLES_GET, message);
        };
        this._onDelete = (message) => {
            if (message.callID !== this.call.id)
                return;
            this.vars = message.params.variables;
            this.call.emit(events_2.APP_EVENTS.VARIABLES_DELETE, message);
        };
        this.call.on(events_2.WS_CALL_EVENTS.VARIABLES_SET, this._onSet);
        this.call.on(events_2.WS_CALL_EVENTS.VARIABLES_GET, this._onGet);
        this.call.on(events_2.WS_CALL_EVENTS.VARIABLES_DELETE, this._onDelete);
    }
    destroy() {
        if (this._onSet) {
            this.call.off(events_2.WS_CALL_EVENTS.VARIABLES_SET, this._onSet);
            this.call.off(events_2.WS_CALL_EVENTS.VARIABLES_GET, this._onGet);
            this.call.off(events_2.WS_CALL_EVENTS.VARIABLES_DELETE, this._onDelete);
            this._onSet = null;
            this._onGet = null;
            this._onDelete = null;
        }
    }
    set(variables) {
        this.call.send(actions_1.variablesSet(variables));
    }
    delete(name) {
        this.call.send(actions_1.variablesDelete(name));
    }
    get() {
        this.call.send(actions_1.variablesGet());
    }
}
exports.default = ProPBXVariables;
//# sourceMappingURL=variables.js.map