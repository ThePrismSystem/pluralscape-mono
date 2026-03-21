import type { ChecksumHex } from "./ids.js";

/** Expected length of a checksum hex digest. */
const CHECKSUM_HEX_LENGTH = 64;

/** Pattern for lowercase hex characters. */
const HEX_PATTERN = /^[0-9a-f]+$/;

/**
 * Validate and cast a string to a branded ChecksumHex.
 * Accepts uppercase hex and normalizes to lowercase.
 * Throws if the input is not exactly 64 hex characters.
 */
export function toChecksumHex(hex: string): ChecksumHex {
  if (hex.length !== CHECKSUM_HEX_LENGTH) {
    throw new Error(
      `Expected ${String(CHECKSUM_HEX_LENGTH)}-char hex digest, got ${String(hex.length)}`,
    );
  }
  const lower = hex.toLowerCase();
  if (!HEX_PATTERN.test(lower)) {
    throw new Error("Checksum hex digest must contain only hex characters");
  }
  return lower as ChecksumHex;
}
