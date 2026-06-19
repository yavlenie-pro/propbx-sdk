/**
 * Sanitize a plain JS value for encoding into a `google.protobuf.Struct`.
 *
 * @grpc/proto-loader encodes plain objects to Struct automatically, but Struct
 * cannot represent `undefined` (only `null` -> NullValue), and binary/functions
 * have no Struct mapping. We strip those before writing so a stray `undefined`
 * (e.g. an omitted `ssml` in a tts action) never breaks serialization.
 *
 * Notes:
 *  - `null` is preserved (NullValue) — some actions pass `headers: null`.
 *  - Numbers become doubles on the wire; the Go server reads them as float64,
 *    so integers round-trip harmlessly. NaN/Infinity are not representable and
 *    are converted to null.
 *  - Array holes / `undefined` elements become `null` (a ListValue can't have
 *    holes, and dropping would shift indices).
 */
export function sanitizeForStruct(value: any): any {
    if (value === null) return null;

    const t = typeof value;
    if (t === 'string' || t === 'boolean') return value;
    if (t === 'number') return Number.isFinite(value) ? value : null;
    if (t === 'bigint') return Number(value);

    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        // Binary cannot live in a Struct. We never legitimately send binary in
        // params (file bytes go as a base64 string via file-response), so drop it.
        return undefined;
    }

    if (Array.isArray(value)) {
        return value.map((v) => {
            const sv = sanitizeForStruct(v);
            return sv === undefined ? null : sv;
        });
    }

    if (t === 'object') {
        const out: Record<string, any> = {};
        for (const k of Object.keys(value)) {
            const sv = sanitizeForStruct(value[k]);
            if (sv !== undefined) out[k] = sv;
        }
        return out;
    }

    // function, symbol, undefined -> dropped
    return undefined;
}
