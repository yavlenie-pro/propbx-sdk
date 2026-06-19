/**
 * Reassembles MediaChunk frames (the recording downlink) back into whole
 * recordings. A media object is 1..N chunks sharing the same `media_id`
 * (== recordingID): `seq` starts at 0 and increments by 1, the last chunk has
 * `eof = true`, and `info` is present only on `seq == 0`. Chunks of different
 * `media_id` may interleave on the stream, so we always demultiplex by
 * `media_id`. A single gRPC stream is strictly ordered, so a `seq` gap means
 * corruption — we fail that media rather than attempt to resequence.
 */
import { EventEmitter } from 'events';

export interface MediaInfo {
    kind?: string;
    format?: string;
    sample_rate?: number;
    channels?: number;
    total_bytes?: number;
    duration_ms?: number;
}

export interface MediaChunkFrame {
    media_id: string;
    call_id: string;
    seq: number;
    eof: boolean;
    data: Buffer | Uint8Array;
    info?: MediaInfo;
}

export interface ReassembledMedia {
    recordingID: string;
    callID: string;
    buffer: Buffer;
    info: MediaInfo;
}

interface MediaState {
    callID: string;
    info: MediaInfo;
    expectedSeq: number;
    received: number;
    /** Pre-sized buffer when total_bytes was known on seq 0; else null. */
    prealloc: Buffer | null;
    /** Fallback accumulator when size was unknown. */
    chunks: Buffer[];
}

function toBuffer(data: Buffer | Uint8Array): Buffer {
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

/**
 * Emits:
 *  - `'media'` (ReassembledMedia) when a media_id reaches eof.
 *  - `'mediaError'` ({ recordingID, callID, error }) on a contiguity violation.
 *    (Named `mediaError`, not `error`, so an unlistened emit never throws.)
 */
export class MediaAssembler extends EventEmitter {
    private readonly media = new Map<string, MediaState>();

    push(chunk: MediaChunkFrame): void {
        const id = chunk.media_id;
        let state = this.media.get(id);

        if (chunk.seq === 0) {
            // (Re)start. A retransmitted seq 0 resets the buffer.
            const info: MediaInfo = chunk.info || {};
            const total = info.total_bytes || 0;
            state = {
                callID: chunk.call_id,
                info,
                expectedSeq: 0,
                received: 0,
                prealloc: total > 0 ? Buffer.allocUnsafe(total) : null,
                chunks: [],
            };
            this.media.set(id, state);
        } else if (!state) {
            // First time we see this media but seq != 0 — we missed seq 0.
            this.fail(id, chunk.call_id, new Error(`media ${id}: first chunk seq=${chunk.seq}, expected 0`));
            return;
        }

        if (chunk.seq !== state!.expectedSeq) {
            this.fail(
                id,
                state!.callID,
                new Error(`media ${id}: out-of-order chunk seq=${chunk.seq}, expected ${state!.expectedSeq}`),
            );
            return;
        }

        const data = toBuffer(chunk.data);
        if (data.length > 0) {
            if (state!.prealloc) {
                data.copy(state!.prealloc, state!.received);
            } else {
                state!.chunks.push(data);
            }
            state!.received += data.length;
        }
        state!.expectedSeq += 1;

        if (chunk.eof) {
            const buffer = state!.prealloc
                ? state!.prealloc.subarray(0, state!.received)
                : Buffer.concat(state!.chunks, state!.received);
            this.media.delete(id);
            const out: ReassembledMedia = {
                recordingID: id,
                callID: state!.callID,
                buffer,
                info: state!.info,
            };
            this.emit('media', out);
        }
    }

    private fail(recordingID: string, callID: string, error: Error): void {
        this.media.delete(recordingID);
        this.emit('mediaError', { recordingID, callID, error });
    }

    /** Drop all partial reassemblies (e.g. on a full session reconnect). */
    reset(): void {
        this.media.clear();
    }

    /** Number of in-flight (incomplete) media — for diagnostics/tests. */
    pendingCount(): number {
        return this.media.size;
    }
}
