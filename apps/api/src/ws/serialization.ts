/**
 * Base64url ↔ Uint8Array conversion for the JSON wire format.
 *
 * V1 transport is text-framed JSON. Binary fields (ciphertext, nonce,
 * signature, authorPublicKey) are Base64url strings on the wire but
 * Uint8Array in TypeScript types.
 */

/** Convert a Base64url string to Uint8Array. */
export function base64urlToBytes(input: string): Uint8Array {
  return new Uint8Array(Buffer.from(input, "base64url"));
}

/** Convert a Uint8Array to Base64url string. */
export function bytesToBase64url(input: Uint8Array): string {
  return Buffer.from(input).toString("base64url");
}
