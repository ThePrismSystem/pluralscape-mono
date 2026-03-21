import { getSodium } from "@pluralscape/crypto";

import { env } from "../env.js";
import { EMAIL_HASH_LENGTH, PEPPER_HEX_LENGTH } from "../routes/auth/auth.constants.js";

import { fromHex, toHex } from "./hex.js";

/**
 * Get the global email hash pepper from environment.
 * The pepper is a server secret used as the BLAKE2b key for deterministic email hashing.
 * Losing this value breaks all email lookups — it must be backed up securely.
 */
export function getEmailHashPepper(): Uint8Array {
  const hex = env.EMAIL_HASH_PEPPER;
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
  return fromHex(hex);
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
