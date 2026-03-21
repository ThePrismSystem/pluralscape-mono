/**
 * Hex encoding/decoding utilities.
 *
 * Mirrors the canonical implementation in @pluralscape/crypto/hex.
 * Kept as a local module because many API service tests vi.mock("@pluralscape/crypto")
 * which replaces the entire module (including constants), breaking any
 * imports from it.
 */

/** Radix for hexadecimal encoding (base 16). */
const HEX_RADIX = 16;

/** Number of hex characters per byte. */
const HEX_CHARS_PER_BYTE = 2;

/** Converts a byte array to a lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(HEX_RADIX).padStart(HEX_CHARS_PER_BYTE, "0"))
    .join("");
}

/** Decode a hex string to bytes. Throws on invalid hex. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % HEX_CHARS_PER_BYTE !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / HEX_CHARS_PER_BYTE);
  for (let i = 0; i < bytes.length; i++) {
    const offset = i * HEX_CHARS_PER_BYTE;
    bytes[i] = parseInt(hex.slice(offset, offset + HEX_CHARS_PER_BYTE), HEX_RADIX);
  }
  return bytes;
}
