/**
 * Correlates recording bytes (reassembled from MediaStream) with the control
 * events that reference them (`recordingComplete`, `callFinished`), so the SDK
 * can surface a recording in the SAME shape the v1 SDK used: the recording
 * entry gets `data`/`binaryData` (base64 WAV) plus a convenience `buffer`,
 * keyed by recordingID — bot code never sees that the bytes came over a side
 * stream.
 *
 * The event and its bytes arrive on two independent HTTP/2 streams with no
 * ordering guarantee, so both orderings are handled:
 *   - bytes-before-event: bytes are stashed; the later event injects immediately.
 *   - event-before-bytes: the event is held until its bytes finish reassembling,
 *     or until a per-recording timeout fires (then the entry is left
 *     metadata-only — the expected path when the server fell back to CDR/S3
 *     because no MediaStream was open).
 *
 * Bytes are NOT consumed on injection: the same recordingID may be referenced by
 * both a `recordingComplete` and the final `callFinished`, and both must carry
 * the audio. Entries are evicted on `callFinished` (the call is over) and by a
 * backstop TTL to bound memory.
 */
import { ReassembledMedia } from './mediaAssembler';

export interface RecordingCorrelatorOptions {
    /** How long to hold an event waiting for its bytes before emitting metadata-only. ms. */
    recordingTimeoutMs?: number;
    /** Backstop TTL for stashed bytes that no event ever claims. ms. */
    bytesTtlMs?: number;
}

interface Waiter {
    resolve: (media: ReassembledMedia | null) => void;
    timer: NodeJS.Timeout;
}

interface StoredBytes {
    media: ReassembledMedia;
    ttl: NodeJS.Timeout;
}

const DEFAULT_RECORDING_TIMEOUT_MS = 15000;
const DEFAULT_BYTES_TTL_MS = 300000; // 5 min

export class RecordingCorrelator {
    private readonly recordingTimeoutMs: number;
    private readonly bytesTtlMs: number;
    private readonly bytesByRecId = new Map<string, StoredBytes>();
    private readonly waitersByRecId = new Map<string, Waiter[]>();

    constructor(opts: RecordingCorrelatorOptions = {}) {
        this.recordingTimeoutMs = opts.recordingTimeoutMs ?? DEFAULT_RECORDING_TIMEOUT_MS;
        this.bytesTtlMs = opts.bytesTtlMs ?? DEFAULT_BYTES_TTL_MS;
    }

    /** Feed a finished reassembly in. Resolves any events already waiting on it. */
    addMedia(media: ReassembledMedia): void {
        const id = media.recordingID;

        // Stash (replacing any prior entry for this id), with a backstop TTL.
        const existing = this.bytesByRecId.get(id);
        if (existing) clearTimeout(existing.ttl);
        const ttl = setTimeout(() => this.bytesByRecId.delete(id), this.bytesTtlMs);
        if (typeof ttl.unref === 'function') ttl.unref();
        this.bytesByRecId.set(id, { media, ttl });

        // Wake any waiters (without consuming the bytes).
        const waiters = this.waitersByRecId.get(id);
        if (waiters) {
            this.waitersByRecId.delete(id);
            for (const w of waiters) {
                clearTimeout(w.timer);
                w.resolve(media);
            }
        }
    }

    /**
     * Given an outgoing control message, fill in recording audio before it is
     * dispatched to the app. Returns the same (mutated) message once all
     * referenced recordings are injected or timed out. Safe to call on any
     * message; non-recording messages resolve immediately.
     */
    async correlate(message: any, type: string): Promise<any> {
        const entries = this.entriesForMessage(message, type);
        if (entries.length === 0) return message;

        await Promise.all(
            entries.map(async (entry) => {
                const id = entry.recordingID;
                if (!id) return;
                const media = await this.getOrWait(id);
                if (media) this.inject(media, entry);
            }),
        );

        // The call is over on callFinished — drop its bytes now.
        if (type === 'callFinished') {
            for (const entry of entries) {
                if (entry.recordingID) this.evict(entry.recordingID);
            }
        }
        return message;
    }

    /** The recording entry object(s) within a message that must be filled. */
    private entriesForMessage(message: any, type: string): any[] {
        const params = message?.params ?? {};
        if (type === 'recordingComplete') {
            // The metadata entry IS params; recordingID is also hoisted top-level.
            if (!params.recordingID && message?.recordingID) {
                params.recordingID = message.recordingID;
            }
            return params.recordingID ? [params] : [];
        }
        if (type === 'callFinished') {
            const recordings = Array.isArray(params.recordings) ? params.recordings : [];
            return recordings.filter((r: any) => r && r.recordingID);
        }
        return [];
    }

    private getOrWait(id: string): Promise<ReassembledMedia | null> {
        const stored = this.bytesByRecId.get(id);
        if (stored) return Promise.resolve(stored.media);

        return new Promise<ReassembledMedia | null>((resolve) => {
            // NOTE: this timer is intentionally NOT unref'd — a held event's
            // promise depends on it firing to resolve metadata-only on timeout.
            const timer = setTimeout(() => {
                // Remove this waiter on timeout, then resolve null (metadata-only).
                const list = this.waitersByRecId.get(id);
                if (list) {
                    const idx = list.indexOf(waiter);
                    if (idx >= 0) list.splice(idx, 1);
                    if (list.length === 0) this.waitersByRecId.delete(id);
                }
                resolve(null);
            }, this.recordingTimeoutMs);

            const waiter: Waiter = { resolve, timer };
            const list = this.waitersByRecId.get(id);
            if (list) list.push(waiter);
            else this.waitersByRecId.set(id, [waiter]);
        });
    }

    private inject(media: ReassembledMedia, entry: any): void {
        const b64 = media.buffer.toString('base64');
        entry.data = b64;
        entry.binaryData = b64;
        entry.buffer = media.buffer;
        // Reconcile metadata the server may have omitted on the metadata-only entry.
        if (entry.size == null) entry.size = media.buffer.length;
        if (entry.format == null && media.info?.format) entry.format = media.info.format;
        if (entry.duration_ms == null && media.info?.duration_ms != null) {
            entry.duration_ms = media.info.duration_ms;
        }
    }

    private evict(id: string): void {
        const stored = this.bytesByRecId.get(id);
        if (stored) {
            clearTimeout(stored.ttl);
            this.bytesByRecId.delete(id);
        }
    }

    /** Clear all state and timers (on reconnect / shutdown). Pending waiters resolve null. */
    dispose(): void {
        for (const stored of this.bytesByRecId.values()) clearTimeout(stored.ttl);
        this.bytesByRecId.clear();
        for (const waiters of this.waitersByRecId.values()) {
            for (const w of waiters) {
                clearTimeout(w.timer);
                w.resolve(null);
            }
        }
        this.waitersByRecId.clear();
    }
}
