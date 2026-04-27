import { z } from "zod/v4";

/**
 * Bidirectional codec for the binary↔base64 boundary used inside JSON-encoded
 * AEAD plaintexts. Wire side is a base64 string (what `JSON.parse` produces);
 * memory side is a `Uint8Array` (what crypto operations consume).
 *
 * Usage:
 * ```
 *   z.decode(Base64ToUint8ArrayCodec, "<base64>")  // → Uint8Array
 *   z.encode(Base64ToUint8ArrayCodec, bytes)       // → base64 string
 * ```
 */
export const Base64ToUint8ArrayCodec = z.codec(z.base64(), z.instanceof(Uint8Array), {
  decode: (b64) => z.util.base64ToUint8Array(b64),
  encode: (bytes) => z.util.uint8ArrayToBase64(bytes),
});
