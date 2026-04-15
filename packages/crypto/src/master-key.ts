import {
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_MEMLIMIT_MOBILE,
  PWHASH_OPSLIMIT_MOBILE,
  PWHASH_OPSLIMIT_SENSITIVE,
  PWHASH_SALT_BYTES,
} from "./crypto.constants.js";
import { getSodium } from "./sodium.js";

import type { PwhashSalt } from "./types.js";

/**
 * Password hashing profile. Controls Argon2id parameters.
 * - "server": 64 MiB / 4 iterations (OPSLIMIT_SENSITIVE + MEMLIMIT_INTERACTIVE)
 *   Meets OWASP Sensitive tier: m=65536, t>=4, p=1.
 * - "mobile": 32 MiB / 2 iterations (OPSLIMIT_MOBILE + MEMLIMIT_MOBILE)
 */
export type PwhashProfile = "server" | "mobile";

export interface ProfileParams {
  readonly opsLimit: number;
  readonly memLimit: number;
}

export const PROFILE_PARAMS: Readonly<Record<PwhashProfile, ProfileParams>> = {
  // Server: 4 iterations + 64 MiB — meets OWASP Sensitive tier (m=65536, t=4, p=1).
  server: { opsLimit: PWHASH_OPSLIMIT_SENSITIVE, memLimit: PWHASH_MEMLIMIT_INTERACTIVE },
  mobile: { opsLimit: PWHASH_OPSLIMIT_MOBILE, memLimit: PWHASH_MEMLIMIT_MOBILE },
};

/** Generate a random 16-byte salt for password hashing. */
export function generateSalt(): PwhashSalt {
  const adapter = getSodium();
  return adapter.randomBytes(PWHASH_SALT_BYTES) as PwhashSalt;
}
