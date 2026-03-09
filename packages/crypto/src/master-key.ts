import {
  KDF_KEY_BYTES,
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_MEMLIMIT_MOBILE,
  PWHASH_OPSLIMIT_MOBILE,
  PWHASH_OPSLIMIT_MODERATE,
  PWHASH_SALT_BYTES,
} from "./constants.js";
import { getSodium } from "./sodium.js";

import type { KdfMasterKey, PwhashSalt } from "./types.js";

/**
 * Password hashing profile. Controls Argon2id parameters.
 * - "server": 64 MiB / 3 iterations (OPSLIMIT_MODERATE + MEMLIMIT_INTERACTIVE)
 * - "mobile": 32 MiB / 2 iterations (OPSLIMIT_MOBILE + MEMLIMIT_MOBILE)
 */
export type PwhashProfile = "server" | "mobile";

interface ProfileParams {
  readonly opsLimit: number;
  readonly memLimit: number;
}

const PROFILE_PARAMS: Readonly<Record<PwhashProfile, ProfileParams>> = {
  server: { opsLimit: PWHASH_OPSLIMIT_MODERATE, memLimit: PWHASH_MEMLIMIT_INTERACTIVE },
  mobile: { opsLimit: PWHASH_OPSLIMIT_MOBILE, memLimit: PWHASH_MEMLIMIT_MOBILE },
};

/**
 * Derive a master key from a password and salt using Argon2id.
 * Returns a Promise for API compatibility — pwhash may be offloaded
 * to a WebWorker in the future to avoid blocking the main thread.
 */
export function deriveMasterKey(
  password: string,
  salt: PwhashSalt,
  profile: PwhashProfile,
): Promise<KdfMasterKey> {
  const adapter = getSodium();
  const passwordBytes = new TextEncoder().encode(password);
  const { opsLimit, memLimit } = PROFILE_PARAMS[profile];
  const derived = adapter.pwhash(KDF_KEY_BYTES, passwordBytes, salt, opsLimit, memLimit);
  return Promise.resolve(derived as KdfMasterKey);
}

/** Generate a random 16-byte salt for password hashing. */
export function generateSalt(): PwhashSalt {
  const adapter = getSodium();
  return adapter.randomBytes(PWHASH_SALT_BYTES) as PwhashSalt;
}
