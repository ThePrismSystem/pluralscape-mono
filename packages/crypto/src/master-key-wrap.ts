import { KDF_KEY_BYTES } from "./crypto.constants.js";
import { getSodium } from "./sodium.js";
import { decrypt, encrypt } from "./symmetric.js";
import { assertKdfMasterKey } from "./validation.js";

import type { EncryptedPayload } from "./symmetric.js";
import type { AeadKey, KdfMasterKey } from "./types.js";

/**
 * Generate a random persistent MasterKey (32 bytes).
 *
 * Unlike the legacy deriveMasterKey(), this key is NOT derived from the password —
 * it is stored encrypted (wrapped) in the database and survives password resets.
 * The KEK/DEK pattern: MasterKey is the DEK, password-derived key is the KEK.
 */
export function generateMasterKey(): KdfMasterKey {
  const adapter = getSodium();
  const raw = adapter.randomBytes(KDF_KEY_BYTES);
  assertKdfMasterKey(raw);
  return raw;
}

/**
 * Wrap (encrypt) a MasterKey under a password-derived key (KEK).
 *
 * The resulting EncryptedPayload is stored in the `accounts.encrypted_master_key`
 * column and re-encrypted on password change without invalidating any derived keys.
 */
export function wrapMasterKey(masterKey: KdfMasterKey, passwordKey: AeadKey): EncryptedPayload {
  return encrypt(masterKey, passwordKey);
}

/**
 * Unwrap (decrypt) a MasterKey using a password-derived key (KEK).
 *
 * Throws DecryptionFailedError if the key is wrong or the blob is tampered.
 */
export function unwrapMasterKey(wrapped: EncryptedPayload, passwordKey: AeadKey): KdfMasterKey {
  const raw = decrypt(wrapped, passwordKey);
  assertKdfMasterKey(raw);
  return raw;
}
