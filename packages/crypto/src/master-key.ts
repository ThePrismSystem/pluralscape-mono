import { PWHASH_SALT_BYTES } from "./crypto.constants.js";
import { getSodium } from "./sodium.js";

import type { PwhashSalt } from "./types.js";

/** Generate a random 16-byte salt for password hashing. */
export function generateSalt(): PwhashSalt {
  const adapter = getSodium();
  return adapter.randomBytes(PWHASH_SALT_BYTES) as PwhashSalt;
}
