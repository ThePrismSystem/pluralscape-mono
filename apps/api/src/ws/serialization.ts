/**
 * Base64url <-> Uint8Array conversion for the JSON wire format.
 *
 * V1 transport is text-framed JSON. Binary fields (ciphertext, nonce,
 * signature, authorPublicKey) are Base64url strings on the wire but
 * Uint8Array in TypeScript types.
 *
 * P-H4: Uses targeted field-path conversion instead of recursive tree walk.
 * Binary fields are at known locations in the protocol schema, so we walk
 * only those paths rather than visiting every property in the object tree.
 */
import type { EncryptedChangeEnvelope, ServerMessage } from "@pluralscape/sync";

/** Convert a Base64url string to Uint8Array. */
export function base64urlToBytes(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, "base64url"));
}

/** Convert a Uint8Array to Base64url string. */
export function bytesToBase64url(input: Uint8Array): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Field names that contain Uint8Array values in envelope types.
 * Constrained against EncryptedChangeEnvelope so new binary fields
 * cause a compile error if not added here.
 */
const ENVELOPE_BINARY_FIELDS = [
  "ciphertext",
  "nonce",
  "signature",
  "authorPublicKey",
] as const satisfies readonly (keyof EncryptedChangeEnvelope)[];

/**
 * Convert binary fields in an envelope-shaped object to base64url strings.
 * Returns a shallow copy with only the binary fields replaced.
 */
function transformEnvelope(envelope: Record<string, unknown>): Record<string, unknown> {
  const result = { ...envelope };
  for (const field of ENVELOPE_BINARY_FIELDS) {
    const value = result[field];
    if (value instanceof Uint8Array) {
      result[field] = bytesToBase64url(value);
    }
  }
  return result;
}

/** Transform a message whose binary data lives in a top-level `changes` array. */
function transformChangesArray(msg: Record<string, unknown>): Record<string, unknown> {
  const changes = msg["changes"];
  if (!Array.isArray(changes)) return msg;
  return { ...msg, changes: changes.map(transformEnvelope) };
}

/**
 * Map of ServerMessage types to functions that transform their binary fields.
 *
 * Only message types that contain Uint8Array data need entries here:
 *   - SnapshotResponse  — snapshot envelope
 *   - ChangesResponse   — changes array of envelopes
 *   - DocumentUpdate    — changes array of envelopes
 *   - SubscribeResponse — catchup array containing snapshot + changes
 *
 * Messages without binary fields (AuthenticateResponse, ManifestResponse,
 * ChangeAccepted, SnapshotAccepted, ManifestChanged, SyncError) are
 * serialized directly without transformation. When adding a new ServerMessage
 * type with Uint8Array fields, add a corresponding entry here.
 */
const BINARY_FIELD_PATHS: Partial<
  Record<ServerMessage["type"], (msg: Record<string, unknown>) => Record<string, unknown>>
> = {
  SnapshotResponse: (msg) => {
    const snapshot = msg["snapshot"] as Record<string, unknown> | null;
    if (!snapshot) return msg;
    return { ...msg, snapshot: transformEnvelope(snapshot) };
  },

  ChangesResponse: transformChangesArray,

  DocumentUpdate: transformChangesArray,

  SubscribeResponse: (msg) => {
    const catchup = msg["catchup"];
    if (!Array.isArray(catchup)) return msg;
    return {
      ...msg,
      catchup: catchup.map((entry: Record<string, unknown>) => {
        const changes = entry["changes"];
        const snapshot = entry["snapshot"] as Record<string, unknown> | null;
        return {
          ...entry,
          changes: Array.isArray(changes) ? changes.map(transformEnvelope) : changes,
          snapshot: snapshot ? transformEnvelope(snapshot) : null,
        };
      }),
    };
  },
};

/**
 * Recursively walk an object tree, returning a deep copy with all
 * Uint8Array fields converted to base64url strings.
 *
 * Returns primitives, null, and non-object values unchanged.
 *
 * For ServerMessage serialization, prefer serializeServerMessage which
 * uses the targeted BINARY_FIELD_PATHS approach for better performance.
 * This generic function is still useful for arbitrary objects.
 */
export function transformBinaryFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Uint8Array) {
    return bytesToBase64url(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => transformBinaryFields(item));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = transformBinaryFields(value);
    }
    return result;
  }

  return obj;
}

/** Serialize a ServerMessage to JSON, converting Uint8Array fields to Base64url. */
export function serializeServerMessage(msg: ServerMessage): string {
  const transformer = BINARY_FIELD_PATHS[msg.type];
  if (transformer) {
    return JSON.stringify(transformer({ ...msg }));
  }
  // No binary fields — serialize directly
  return JSON.stringify(msg);
}
