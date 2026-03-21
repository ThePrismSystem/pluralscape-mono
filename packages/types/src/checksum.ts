import type { ChecksumHex } from "./ids.js";

/** Expected length of a checksum hex digest. */
const CHECKSUM_HEX_LENGTH = 64;

/** Pattern for lowercase hex characters. */
const HEX_PATTERN = /^[0-9a-f]+$/;

/**
 * Validate and cast a string to a branded ChecksumHex.
 * Throws if the input is not exactly 64 lowercase hex characters.
 */
export function toChecksumHex(hex: string): ChecksumHex {
  if (hex.length !== CHECKSUM_HEX_LENGTH) {
    throw new Error(
      `Expected ${String(CHECKSUM_HEX_LENGTH)}-char hex digest, got ${String(hex.length)}`,
    );
  }
  if (!HEX_PATTERN.test(hex)) {
    throw new Error("Checksum hex digest must contain only lowercase hex characters");
  }
  return hex as ChecksumHex;
}
