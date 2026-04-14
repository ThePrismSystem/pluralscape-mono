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
  EncryptedKeyGrant,
  KdfMasterKey,
  KeyVersion,
  PwhashSalt,
  Signature,
  SignKeypair,
  SignPublicKey,
  SignSecretKey,
} from "./types.js";
export type { SodiumAdapter, SodiumConstants } from "./adapter/interface.js";
export type {
  Clock,
  KeyLifecycleConfig,
  KeyLifecycleDeps,
  KeyLifecycleManager,
  KeyLifecycleState,
  NativeMemzero,
  SecurityPresetLevel,
  TimerHandle,
} from "./lifecycle-types.js";

// ── Errors ──────────────────────────────────────────────────────────
export {
  AlreadyInitializedError,
  BiometricFailedError,
  CryptoNotReadyError,
  DecryptionFailedError,
  InvalidInputError,
  InvalidStateTransitionError,
  KeysLockedError,
  KeyStorageFailedError,
  SignatureVerificationError,
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
  GENERIC_HASH_BYTES_MAX,
  GENERIC_HASH_BYTES_MIN,
  HEX_CHARS_PER_BYTE,
  HEX_RADIX,
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
  PWHASH_OPSLIMIT_SENSITIVE,
  PWHASH_SALT_BYTES,
  SAFETY_NUMBER_HASH_BYTES,
  SAFETY_NUMBER_ITERATIONS,
  SAFETY_NUMBER_VERSION,
  SIGN_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
  SIGN_SEED_BYTES,
  SODIUM_CONSTANTS,
} from "./crypto.constants.js";

// ── Hex encoding ─────────────────────────────────────────────────────
export { fromHex, toHex } from "./hex.js";

// ── Sodium lifecycle ────────────────────────────────────────────────
export { configureSodium, getSodium, initSodium, isReady } from "./sodium.js";

// ── Master key ──────────────────────────────────────────────────────
export type { PwhashProfile } from "./master-key.js";
export { generateSalt } from "./master-key.js";

// ── Password hashing (string-based) ────────────────────────────────
export { hashPassword, verifyPassword } from "./password.js";

// ── PIN hashing (string-based) ─────────────────────────────────────
export { hashPin, MIN_PIN_LENGTH, verifyPin } from "./pin.js";

// ── Master key wrap (KEK/DEK two-layer architecture) ─────────────────
export {
  derivePasswordKey,
  generateMasterKey,
  unwrapMasterKey,
  wrapMasterKey,
} from "./master-key-wrap.js";

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
export {
  generateRecoveryKey,
  isValidRecoveryKeyFormat,
  recoverMasterKey,
  toRecoveryKeyDisplay,
} from "./recovery.js";

// ── Recovery backup serialization ────────────────────────────────────
export { deserializeRecoveryBackup, serializeRecoveryBackup } from "./recovery-backup.js";

// ── Password reset via recovery key ──────────────────────────────────
export type { PasswordResetParams, PasswordResetResult } from "./password-reset.js";
export { resetPasswordViaRecoveryKey } from "./password-reset.js";

// ── Recovery key regeneration ─────────────────────────────────────────
export type { RegenerateResult } from "./recovery-regeneration.js";
export { regenerateRecoveryKey } from "./recovery-regeneration.js";

// ── Device transfer protocol ──────────────────────────────────────────
export type { DecodedQRPayload, TransferInitiation } from "./device-transfer.js";
export {
  TRANSFER_TIMEOUT_MS,
  decodeQRPayload,
  decryptFromTransfer,
  deriveTransferKey,
  encodeQRPayload,
  encryptForTransfer,
  generateTransferCode,
  isValidTransferCode,
} from "./device-transfer.js";

// ── Signature operations ─────────────────────────────────────────────
export { decryptThenVerify, sign, signThenEncrypt, verify } from "./sign.js";

// ── Key storage ──────────────────────────────────────────────────────
export type { KeyStorageOpts, SecureKeyStorage } from "./key-storage.js";
export { createWebKeyStorage } from "./web-key-storage.js";

// ── Safety Number verification ───────────────────────────────────────
export type { SafetyNumber } from "./safety-number.js";
export { computeSafetyNumber } from "./safety-number.js";

// ── Sync key derivation ──────────────────────────────────────────────
export { deriveSyncEncryptionKey } from "./sync-keys.js";

// ── Native memzero wrapper ──────────────────────────────────────────
export { wrapNativeMemzero } from "./adapter/native-memzero.js";

// ── Key lifecycle manager ───────────────────────────────────────────
export { MobileKeyLifecycleManager, SECURITY_PRESETS } from "./key-lifecycle.js";

// ── Validation ─────────────────────────────────────────────────────────
export {
  assertAeadKey,
  assertAeadNonce,
  assertBufferLength,
  assertPwhashSalt,
  assertSignature,
  assertSignPublicKey,
} from "./validation.js";

// ── Key grants (Privacy Bucket sharing) ──────────────────────────────
export type {
  CreateKeyGrantParams,
  CreateKeyGrantsBatchParams,
  DecryptKeyGrantParams,
  KeyGrantBlob,
} from "./key-grants.js";
export { createKeyGrant, createKeyGrants, decryptKeyGrant } from "./key-grants.js";
