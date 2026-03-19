/**
 * Base64url ↔ Uint8Array conversion for the JSON wire format.
 *
 * V1 transport is text-framed JSON. Binary fields (ciphertext, nonce,
 * signature, authorPublicKey) are Base64url strings on the wire but
 * Uint8Array in TypeScript types.
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

/** Serialize a ServerMessage to JSON, converting Uint8Array fields to Base64url. */
export function serializeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg, (_key, value: unknown) => {
    if (value instanceof Uint8Array) {
      return bytesToBase64url(value);
    }
    return value;
  });
}
