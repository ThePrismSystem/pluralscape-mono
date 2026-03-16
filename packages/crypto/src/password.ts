import { MIN_PASSWORD_LENGTH } from "./crypto.constants.js";
import { InvalidInputError } from "./errors.js";
import { PROFILE_PARAMS, type PwhashProfile } from "./master-key.js";
import { getSodium } from "./sodium.js";

/**
 * Hash a password into a self-contained Argon2id string.
 *
 * Returns the standard `$argon2id$v=19$m=...,t=...,p=...` encoded string
 * suitable for storage in `accounts.passwordHash`. The string embeds the
 * salt and parameters — no separate salt column is needed.
 */
export function hashPassword(password: string, profile: PwhashProfile): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new InvalidInputError(
      `Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters.`,
    );
  }
  const adapter = getSodium();
  const passwordBytes = new TextEncoder().encode(password);
  try {
    const { opsLimit, memLimit } = PROFILE_PARAMS[profile];
    return adapter.pwhashStr(passwordBytes, opsLimit, memLimit);
  } finally {
    adapter.memzero(passwordBytes);
  }
}

/**
 * Verify a password against an Argon2id hash string produced by hashPassword.
 * Returns true if the password matches, false otherwise.
 * Does NOT throw on wrong password — caller decides the error semantics.
 */
export function verifyPassword(hash: string, password: string): boolean {
  const adapter = getSodium();
  const passwordBytes = new TextEncoder().encode(password);
  try {
    return adapter.pwhashStrVerify(hash, passwordBytes);
  } finally {
    adapter.memzero(passwordBytes);
  }
}
