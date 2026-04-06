import { KDF_KEY_BYTES } from "./crypto.constants.js";
import { getSodium } from "./sodium.js";
import { decrypt, encrypt } from "./symmetric.js";
import { assertAeadKey, validateKeyVersion } from "./validation.js";

import type { EncryptedPayload } from "./symmetric.js";
import type { AeadKey, AeadNonce, KdfMasterKey, KeyVersion } from "./types.js";

/** KDF context for bucket key wrapping (must be exactly 8 bytes). */
const KDF_CONTEXT = "bktkeywp";

/** KDF sub-key ID for bucket key wrapping. */
const SUBKEY_BUCKET_KEY_WRAPPING = 1;

/** A bucket symmetric key wrapped (encrypted) under the master key. */
export interface WrappedBucketKey {
  readonly ciphertext: Uint8Array;
  readonly nonce: AeadNonce;
  readonly keyVersion: KeyVersion;
}

/**
 * Re-encrypts a single payload from an old bucket key to a new one.
 *
 * Decrypts with the old key and re-encrypts with the new key.
 * Safe to call multiple times. Not safe to call after either the old
 * or new key has been zeroed from memory.
 */
export type ReEncryptFn = (payload: EncryptedPayload) => EncryptedPayload;

/**
 * Result of a bucket key rotation.
 *
 * `reEncrypt` re-encrypts a payload from the old bucket key to the new one.
 * Caller is responsible for zeroing `newKey` via `adapter.memzero()` when done.
 */
export interface RotatedBucketKey {
  readonly newKey: AeadKey;
  readonly newVersion: KeyVersion;
  readonly reEncrypt: ReEncryptFn;
}

/** Generate a fresh random 256-bit bucket symmetric key. */
export function generateBucketKey(): AeadKey {
  return getSodium().aeadKeygen();
}

/**
 * Encrypt a bucket key under the master key (DEK/KEK envelope).
 *
 * Derives a wrapping key (KEK) from the master key via KDF ("bktkeywp", subkey 1),
 * encrypts the bucket key (DEK) with it, and zeros the wrapping key.
 */
export function encryptBucketKey(
  bucketKey: AeadKey,
  masterKey: KdfMasterKey,
  keyVersion: number,
): WrappedBucketKey {
  const validVersion = validateKeyVersion(keyVersion);
  const adapter = getSodium();
  const wrappingKey = adapter.kdfDeriveFromKey(
    KDF_KEY_BYTES,
    SUBKEY_BUCKET_KEY_WRAPPING,
    KDF_CONTEXT,
    masterKey,
  );
  try {
    assertAeadKey(wrappingKey);
    const result = encrypt(bucketKey, wrappingKey);
    return { ciphertext: result.ciphertext, nonce: result.nonce, keyVersion: validVersion };
  } finally {
    adapter.memzero(wrappingKey);
  }
}

/**
 * Decrypt a wrapped bucket key using the master key.
 *
 * Derives the wrapping key from masterKey, decrypts, validates length, and zeros
 * the wrapping key. Throws DecryptionFailedError on wrong key or tampered data.
 */
export function decryptBucketKey(wrapped: WrappedBucketKey, masterKey: KdfMasterKey): AeadKey {
  const adapter = getSodium();
  const wrappingKey = adapter.kdfDeriveFromKey(
    KDF_KEY_BYTES,
    SUBKEY_BUCKET_KEY_WRAPPING,
    KDF_CONTEXT,
    masterKey,
  );
  try {
    assertAeadKey(wrappingKey);
    const raw = decrypt({ ciphertext: wrapped.ciphertext, nonce: wrapped.nonce }, wrappingKey);
    assertAeadKey(raw);
    return raw;
  } finally {
    adapter.memzero(wrappingKey);
  }
}

/**
 * Rotate a bucket key: generate a new key and return a re-encryption helper.
 *
 * `reEncrypt` decrypts a payload with the old key and re-encrypts with the new key.
 * The caller is responsible for zeroing both the old and new keys when done,
 * including on error paths (e.g., if `reEncrypt` throws mid-rotation).
 */
export function rotateBucketKey(oldKey: AeadKey, currentVersion: number): RotatedBucketKey {
  validateKeyVersion(currentVersion);
  const newKey = generateBucketKey();
  const newVersion = validateKeyVersion(currentVersion + 1);
  const reEncrypt = (payload: EncryptedPayload): EncryptedPayload => {
    const plaintext = decrypt(payload, oldKey);
    try {
      return encrypt(plaintext, newKey);
    } finally {
      plaintext.fill(0);
    }
  };
  return { newKey, newVersion, reEncrypt };
}
