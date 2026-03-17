import { getSodium } from "@pluralscape/crypto";

import { EMAIL_HASH_LENGTH, PEPPER_HEX_LENGTH } from "../routes/auth/auth.constants.js";

import { HEX_RADIX } from "./hex.constants.js";
import { toHex } from "./hex.js";

/** Number of hex characters per byte. */
const HEX_CHARS_PER_BYTE = 2;

/**
 * Get the global email hash pepper from environment.
 * The pepper is a server secret used as the BLAKE2b key for deterministic email hashing.
 * Losing this value breaks all email lookups — it must be backed up securely.
 */
export function getEmailHashPepper(): Uint8Array {
  const hex = process.env["EMAIL_HASH_PEPPER"];
  if (!hex || hex.length === 0) {
    throw new Error(
      "EMAIL_HASH_PEPPER environment variable is required but not set. " +
        "Set it to a 64-character hex string (32 bytes).",
    );
  }
  if (hex.length !== PEPPER_HEX_LENGTH) {
    throw new Error(
      `EMAIL_HASH_PEPPER must be a ${String(PEPPER_HEX_LENGTH)}-character hex string (32 bytes).`,
    );
  }
  const bytes = new Uint8Array(hex.length / HEX_CHARS_PER_BYTE);
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(
      hex.slice(i * HEX_CHARS_PER_BYTE, i * HEX_CHARS_PER_BYTE + HEX_CHARS_PER_BYTE),
      HEX_RADIX,
    );
    if (Number.isNaN(byte)) {
      throw new Error("EMAIL_HASH_PEPPER must be a valid hex string.");
    }
    bytes[i] = byte;
  }
  return bytes;
}

/**
 * Hash an email address for deterministic lookups.
 *
 * Uses BLAKE2b-256 with the global pepper as key.
 * Email is lowercased before hashing for case-insensitive matching.
 * Returns a hex-encoded string suitable for the `emailHash` column.
 */
export function hashEmail(email: string): string {
  const adapter = getSodium();
  const pepper = getEmailHashPepper();
  const normalized = email.toLowerCase().trim();
  const emailBytes = new TextEncoder().encode(normalized);
  const hash = adapter.genericHash(EMAIL_HASH_LENGTH, emailBytes, pepper);
  return toHex(hash);
}
