/**
 * Base64url <-> Uint8Array conversion for the JSON wire format.
 *
 * V1 transport is text-framed JSON. Binary fields (ciphertext, nonce,
 * signature, authorPublicKey) are Base64url strings on the wire but
 * Uint8Array in TypeScript types.
 *
 * M10: Uses a pre-transform pass to convert binary fields before
 * JSON.stringify, separating binary transformation from serialization
 * for better performance (avoids per-key replacer overhead).
 */
import type { ServerMessage } from "@pluralscape/sync";

/** Convert a Base64url string to Uint8Array. */
export function base64urlToBytes(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, "base64url"));
}

/** Convert a Uint8Array to Base64url string. */
export function bytesToBase64url(input: Uint8Array): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Recursively walk an object tree, converting all Uint8Array fields
 * to base64url strings in-place on a shallow copy.
 *
 * Returns primitives, null, and non-object values unchanged.
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
  const transformed = transformBinaryFields(msg);
  return JSON.stringify(transformed);
}
