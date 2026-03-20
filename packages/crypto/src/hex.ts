/**
 * Canonical hex encoding/decoding utilities.
 *
 * Cross-platform (no dependency on Node Buffer or Web Crypto), used for
 * QR payload encoding, device transfer, and any context needing hex strings.
 */

import { InvalidInputError } from "./errors.js";

/** Number of hex characters per byte. */
const HEX_CHARS_PER_BYTE = 2;

/** Radix for hexadecimal parsing/formatting. */
const HEX_RADIX = 16;

/** Pattern matching a valid hex string (even number of hex chars). */
const HEX_PATTERN = /^[0-9a-fA-F]*$/;

/** Encode bytes to a lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(HEX_CHARS_PER_BYTE, "0")).join("");
}

/** Decode a hex string to bytes. Throws InvalidInputError on invalid hex. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % HEX_CHARS_PER_BYTE !== 0 || !HEX_PATTERN.test(hex)) {
    throw new InvalidInputError("Invalid hex string.");
  }
  const bytes = new Uint8Array(hex.length / HEX_CHARS_PER_BYTE);
  for (let i = 0; i < bytes.length; i++) {
    const offset = i * HEX_CHARS_PER_BYTE;
    bytes[i] = parseInt(hex.slice(offset, offset + HEX_CHARS_PER_BYTE), HEX_RADIX);
  }
  return bytes;
}
