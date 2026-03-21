/**
 * Canonical hex encoding/decoding utilities.
 *
 * Cross-platform (no dependency on Node Buffer or Web Crypto), used for
 * QR payload encoding, device transfer, and any context needing hex strings.
 */

import { HEX_RADIX } from "./crypto.constants.js";
import { InvalidInputError } from "./errors.js";

/** Pattern matching a valid hex string (even number of hex chars). */
const HEX_PATTERN = /^[0-9a-fA-F]*$/;

/** Encode bytes to a lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(2, "0")).join("");
}

/** Decode a hex string to bytes. Throws InvalidInputError on invalid hex. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !HEX_PATTERN.test(hex)) {
    throw new InvalidInputError("Invalid hex string.");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const offset = i * 2;
    bytes[i] = parseInt(hex.slice(offset, offset + 2), HEX_RADIX);
  }
  return bytes;
}
