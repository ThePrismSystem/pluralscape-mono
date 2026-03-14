// @pluralscape/crypto — libsodium encryption layer

// ── Types ───────────────────────────────────────────────────────────
export type {
  AeadKey,
  AeadNonce,
  AeadResult,
  BoxKeypair,
  BoxNonce,
  BoxPublicKey,
  BoxSecretKey,
  CryptoKeypair,
  KdfMasterKey,
  PwhashSalt,
  Signature,
  SignKeypair,
  SignPublicKey,
  SignSecretKey,
} from "./types.js";
export type { SodiumAdapter, SodiumConstants } from "./adapter/interface.js";
export type {
  KeyLifecycleManager,
  KeyLifecycleState,
  NativeMemzero,
  SecurityPresetLevel,
} from "./lifecycle-types.js";

// ── Errors ──────────────────────────────────────────────────────────
export {
  AlreadyInitializedError,
  BiometricFailedError,
  CryptoNotReadyError,
  DecryptionFailedError,
  InvalidInputError,
  KeysLockedError,
  KeyStorageFailedError,
  UnsupportedOperationError,
} from "./errors.js";

// ── Constants ───────────────────────────────────────────────────────
export {
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  BOX_MAC_BYTES,
  BOX_NONCE_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  BOX_SEED_BYTES,
  KDF_BYTES_MAX,
  KDF_BYTES_MIN,
  KDF_CONTEXT_BYTES,
  KDF_KEY_BYTES,
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_MEMLIMIT_MOBILE,
  PWHASH_MEMLIMIT_MODERATE,
  PWHASH_OPSLIMIT_INTERACTIVE,
  PWHASH_OPSLIMIT_MOBILE,
  PWHASH_OPSLIMIT_MODERATE,
  PWHASH_SALT_BYTES,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
  SIGN_SEED_BYTES,
  SODIUM_CONSTANTS,
} from "./constants.js";

// ── Sodium lifecycle ────────────────────────────────────────────────
export { configureSodium, getSodium, initSodium, isReady } from "./sodium.js";

// ── Master key ──────────────────────────────────────────────────────
export type { PwhashProfile } from "./master-key.js";
export { deriveMasterKey, generateSalt } from "./master-key.js";

// ── Blob codec ──────────────────────────────────────────────────────
export { deserializeEncryptedBlob, serializeEncryptedBlob } from "./blob-codec.js";

// ── Symmetric encryption ────────────────────────────────────────────
export type { EncryptedPayload, StreamEncryptedPayload } from "./symmetric.js";
export {
  decrypt,
  decryptJSON,
  decryptStream,
  encrypt,
  encryptJSON,
  encryptStream,
} from "./symmetric.js";

// ── Tier helpers ────────────────────────────────────────────────────
export type { Tier2EncryptParams } from "./tiers.js";
export {
  decryptTier1,
  decryptTier1Batch,
  decryptTier2,
  decryptTier2Batch,
  encryptTier1,
  encryptTier1Batch,
  encryptTier2,
  encryptTier2Batch,
  wrapTier3,
} from "./tiers.js";

// ── Identity keypairs ───────────────────────────────────────────────
export type { EncryptedPrivateKey, IdentityKeypair } from "./identity.js";
export {
  decryptPrivateKey,
  encryptPrivateKey,
  generateIdentityKeypair,
  serializePublicKey,
} from "./identity.js";

// ── Bucket key management ───────────────────────────────────────────
export type { BucketKeyCache } from "./bucket-key-cache.js";
export { createBucketKeyCache } from "./bucket-key-cache.js";
export type { ReEncryptFn, RotatedBucketKey, WrappedBucketKey } from "./bucket-keys.js";
export {
  decryptBucketKey,
  encryptBucketKey,
  generateBucketKey,
  rotateBucketKey,
} from "./bucket-keys.js";

// ── Recovery key ────────────────────────────────────────────────────
export type { RecoveryKeyResult } from "./recovery.js";
export { generateRecoveryKey, isValidRecoveryKeyFormat, recoverMasterKey } from "./recovery.js";
