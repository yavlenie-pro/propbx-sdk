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

/**
 * Decode a value that may be a raw `google.protobuf.Struct` / `Value` wrapper
 * into a plain JS object. @grpc/proto-loader hands the `params` field back as the
 * wire shape — e.g. `{ fields: { caller_number: { kind: 'stringValue',
 * stringValue: '79991234567' } } }` — but the v1 message handlers (and apps) read
 * `call.params` as a flat object (`params.message_id`, `params.caller_number`,
 * ...). Without flattening, those reads land on the wrapper instead of the value
 * ("reads in the wrong place") and come back undefined.
 *
 * Idempotent: an already-plain object passes through unchanged, so this is safe
 * whether or not proto-loader flattened the Struct itself.
 */
export function structToPlain(v: any): any {
    if (v == null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(structToPlain);

    // google.protobuf.Value. The proto-loader-decoded shape (oneofs:true) carries
    // a `kind` discriminator and — with defaults:true — every value field present,
    // so there we must trust `kind`. The pre-serialization shape from plainToStruct
    // omits `kind` and sets exactly one value field. Handle both.
    if (typeof v.kind === 'string') {
        switch (v.kind) {
            case 'stringValue': return v.stringValue;
            case 'numberValue': return v.numberValue;
            case 'boolValue': return v.boolValue;
            case 'nullValue': return null;
            case 'structValue': return structToPlain(v.structValue);
            case 'listValue': return structToPlain(v.listValue?.values ?? []);
        }
    }
    if ('stringValue' in v) return v.stringValue;
    if ('numberValue' in v) return v.numberValue;
    if ('boolValue' in v) return v.boolValue;
    if ('nullValue' in v) return null;
    if ('structValue' in v) return structToPlain(v.structValue);
    if ('listValue' in v) return structToPlain(v.listValue?.values ?? []);

    // google.protobuf.Struct
    if (v.fields && typeof v.fields === 'object') {
        const out: Record<string, any> = {};
        for (const k of Object.keys(v.fields)) out[k] = structToPlain(v.fields[k]);
        return out;
    }

    // google.protobuf.ListValue
    if (Array.isArray(v.values)) return v.values.map(structToPlain);

    // Already a plain object — recurse defensively (idempotent pass-through).
    const out: Record<string, any> = {};
    for (const k of Object.keys(v)) out[k] = structToPlain(v[k]);
    return out;
}

/**
 * Encode a plain JS object into the `google.protobuf.Struct` / `Value` wire shape
 * @grpc/proto-loader expects for serialization, e.g.
 * `{ fields: { text: { stringValue: 'hi' } } }`. In this proto-loader config a
 * bare plain object is NOT auto-encoded into a Struct — it serializes to nothing,
 * so the server receives empty params. Run action params through this first.
 *
 * Inverse of structToPlain. Feed it a sanitized value (see sanitizeForStruct):
 * undefined / functions / binary must already be stripped.
 */
export function plainToStruct(obj: any): { fields: Record<string, any> } {
    const fields: Record<string, any> = {};
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const k of Object.keys(obj)) fields[k] = valueToWrapper(obj[k]);
    }
    return { fields };
}

function valueToWrapper(v: any): any {
    if (v === null) return { nullValue: 'NULL_VALUE' };
    const t = typeof v;
    if (t === 'string') return { stringValue: v };
    if (t === 'number') return { numberValue: v };
    if (t === 'boolean') return { boolValue: v };
    if (Array.isArray(v)) return { listValue: { values: v.map(valueToWrapper) } };
    if (t === 'object') return { structValue: plainToStruct(v) };
    // sanitizeForStruct should have removed everything else; be safe.
    return { nullValue: 'NULL_VALUE' };
}
