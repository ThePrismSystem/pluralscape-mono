import { PWHASH_MEMLIMIT_UNIFIED, PWHASH_OPSLIMIT_UNIFIED } from "./crypto.constants.js";
import { InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";

/** Minimum PIN length (4 digits). */
export const MIN_PIN_LENGTH = 4;

/**
 * Hash a PIN into a self-contained Argon2id string.
 *
 * Returns the standard `$argon2id$v=19$m=...,t=...,p=...` encoded string
 * suitable for storage in `systemSettings.pinHash`. The string embeds the
 * salt and parameters — no separate salt column is needed.
 */
export function hashPin(pin: string): string {
  if (pin.length < MIN_PIN_LENGTH) {
    throw new InvalidInputError(`PIN must be at least ${String(MIN_PIN_LENGTH)} characters.`);
  }
  const adapter = getSodium();
  const pinBytes = new TextEncoder().encode(pin);
  try {
    return adapter.pwhashStr(pinBytes, PWHASH_OPSLIMIT_UNIFIED, PWHASH_MEMLIMIT_UNIFIED);
  } finally {
    adapter.memzero(pinBytes);
  }
}

/**
 * Verify a PIN against an Argon2id hash string produced by hashPin.
 * Returns true if the PIN matches, false otherwise.
 * Does NOT throw on wrong PIN — caller decides the error semantics.
 */
export function verifyPin(hash: string, pin: string): boolean {
  const adapter = getSodium();
  const pinBytes = new TextEncoder().encode(pin);
  try {
    return adapter.pwhashStrVerify(hash, pinBytes);
  } finally {
    adapter.memzero(pinBytes);
  }
}
