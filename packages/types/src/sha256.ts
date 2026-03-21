import type { Sha256Hex } from "./ids.js";

/** Expected length of a SHA-256 hex digest. */
const SHA256_HEX_LENGTH = 64;

/** Pattern for lowercase hex characters. */
const HEX_PATTERN = /^[0-9a-f]+$/;

/**
 * Validate and cast a string to a branded Sha256Hex.
 * Throws if the input is not exactly 64 lowercase hex characters.
 */
export function toSha256Hex(hex: string): Sha256Hex {
  if (hex.length !== SHA256_HEX_LENGTH) {
    throw new Error(
      `Expected ${String(SHA256_HEX_LENGTH)}-char hex digest, got ${String(hex.length)}`,
    );
  }
  if (!HEX_PATTERN.test(hex)) {
    throw new Error("SHA-256 hex digest must contain only lowercase hex characters");
  }
  return hex as Sha256Hex;
}
