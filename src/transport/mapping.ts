/**
 * Pure translation between the v1 message shapes and the gRPC frames. Kept
 * separate from the transport so the rules can be unit-tested without a network.
 */
import { sanitizeForStruct, structToPlain } from './struct';

/**
 * v1 action object -> gRPC Action fields. The server reconstructs the v1 message
 * as `params.AsMap()` + `action` + `callID`, so everything EXCEPT `action`/`callID`
 * must go into `params`. `callID` (when present) is promoted to `call_id`.
 */
export function toActionFrame(data: any): { type: string; call_id: string; params: any } {
    const { action, callID, ...rest } = data || {};
    return {
        type: action,
        call_id: callID ?? '',
        params: sanitizeForStruct(rest),
    };
}

/**
 * gRPC Event -> v1-shaped message object. The id fields (`playbackID`,
 * `recordingID`, `sessionID`) live inside the params Struct on the wire but the
 * v1 class handlers read them at the top level, so we hoist them.
 */
export function toClientMessage(ev: any): any {
    const params = structToPlain(ev.params) ?? {};
    return {
        event: ev.type,
        callID: ev.call_id,
        params,
        playbackID: params.playbackID,
        recordingID: params.recordingID,
        sessionID: params.sessionID,
    };
}
