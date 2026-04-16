import {
  AUTH_KEY_BYTES,
  AUTH_KEY_HASH_BYTES,
  CHALLENGE_NONCE_BYTES,
  MIN_PASSWORD_LENGTH,
  PASSWORD_KEY_BYTES,
  PWHASH_MEMLIMIT_UNIFIED,
  PWHASH_OPSLIMIT_UNIFIED,
  RECOVERY_KEY_HASH_BYTES,
  SPLIT_KEY_BYTES,
} from "./crypto.constants.js";
import { InvalidInputError } from "./errors.js";
import { getSodium } from "./sodium.js";
import { assertAeadKey, assertAuthKey } from "./validation.js";

import type {
  AeadKey,
  AuthKey,
  AuthKeyHash,
  ChallengeNonce,
  PwhashSalt,
  RecoveryKeyHash,
  Signature,
  SignPublicKey,
  SignSecretKey,
} from "./types.js";

/** Result of split key derivation from a password. */
export interface SplitKeyResult {
  /** First 32 bytes of derivation — used for server-side auth (never stored). */
  readonly authKey: AuthKey;
  /** Last 32 bytes of derivation — used as AEAD key-encryption key on device. */
  readonly passwordKey: AeadKey;
}

/**
 * Derive an auth key and a password key from a single Argon2id derivation.
 *
 * Runs `Argon2id(password, salt, opsLimit=4, memLimit=64 MiB)` producing 64 bytes,
 * then splits: bytes [0..31] → authKey, bytes [32..63] → passwordKey (AeadKey).
 * The 64-byte derivation buffer is zeroed before return.
 *
 * @param password       - UTF-8 encoded password bytes. Must be ≥ MIN_PASSWORD_LENGTH.
 * @param salt           - 16-byte Argon2id salt (PwhashSalt brand).
 * @param characterCount - Optional character count for length validation. When provided,
 *                         this is used instead of `password.length` (bytes) so that
 *                         multi-byte Unicode passwords are validated by character count.
 */
export function deriveAuthAndPasswordKeys(
  password: Uint8Array,
  salt: PwhashSalt,
  characterCount?: number,
): Promise<SplitKeyResult> {
  const lengthToCheck = characterCount ?? password.length;
  if (lengthToCheck < MIN_PASSWORD_LENGTH) {
    throw new InvalidInputError(
      `Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters.`,
    );
  }

  const adapter = getSodium();
  const derived = adapter.pwhash(
    SPLIT_KEY_BYTES,
    password,
    salt,
    PWHASH_OPSLIMIT_UNIFIED,
    PWHASH_MEMLIMIT_UNIFIED,
  );

  // Split: copy out both halves before zeroing the source buffer.
  const authKey = derived.slice(0, AUTH_KEY_BYTES);
  assertAuthKey(authKey);
  const passwordKeyBytes = derived.slice(AUTH_KEY_BYTES, AUTH_KEY_BYTES + PASSWORD_KEY_BYTES);
  assertAeadKey(passwordKeyBytes);

  adapter.memzero(derived);

  // Returns a Promise for API compatibility — pwhash may be offloaded to a WebWorker.
  return Promise.resolve({ authKey, passwordKey: passwordKeyBytes });
}

/**
 * Hash an auth key with BLAKE2b to produce a 32-byte digest.
 *
 * The hash is stored server-side so the raw authKey never leaves the client.
 */
export function hashAuthKey(authKey: AuthKey): AuthKeyHash {
  const adapter = getSodium();
  return adapter.genericHash(AUTH_KEY_HASH_BYTES, authKey) as AuthKeyHash;
}

/**
 * Constant-time comparison of `authKey` against a stored BLAKE2b hash.
 *
 * Computes the hash of `authKey`, compares it byte-by-byte in constant time
 * against `storedHash`, then zeros the computed hash before returning.
 *
 * @returns true if `authKey` produces the same hash as `storedHash`.
 */
export function verifyAuthKey(authKey: AuthKey, storedHash: AuthKeyHash): boolean {
  if (storedHash.length !== AUTH_KEY_HASH_BYTES) {
    throw new InvalidInputError(
      `storedHash must be ${String(AUTH_KEY_HASH_BYTES)} bytes, got ${String(storedHash.length)}`,
    );
  }

  const adapter = getSodium();
  const computed = adapter.genericHash(AUTH_KEY_HASH_BYTES, authKey);

  const equal = adapter.memcmp(computed, storedHash);

  adapter.memzero(computed);
  return equal;
}

/**
 * Hash a recovery key with BLAKE2b to produce a 32-byte digest.
 *
 * The hash is stored server-side so the raw recovery key never leaves the client.
 */
export function hashRecoveryKey(rawKey: Uint8Array): RecoveryKeyHash {
  const adapter = getSodium();
  return adapter.genericHash(RECOVERY_KEY_HASH_BYTES, rawKey) as RecoveryKeyHash;
}

/**
 * Constant-time comparison of `rawKey` against a stored BLAKE2b hash.
 *
 * @returns true if `rawKey` produces the same hash as `storedHash`.
 */
export function verifyRecoveryKey(rawKey: Uint8Array, storedHash: RecoveryKeyHash): boolean {
  if (storedHash.length !== RECOVERY_KEY_HASH_BYTES) {
    throw new InvalidInputError(
      `storedHash must be ${String(RECOVERY_KEY_HASH_BYTES)} bytes, got ${String(storedHash.length)}`,
    );
  }

  const adapter = getSodium();
  const computed = adapter.genericHash(RECOVERY_KEY_HASH_BYTES, rawKey);

  const equal = adapter.memcmp(computed, storedHash);

  adapter.memzero(computed);
  return equal;
}

/**
 * Generate a 32-byte random challenge nonce for authentication.
 */
export function generateChallengeNonce(): ChallengeNonce {
  const adapter = getSodium();
  return adapter.randomBytes(CHALLENGE_NONCE_BYTES) as ChallengeNonce;
}

/**
 * Sign a challenge nonce with an Ed25519 signing key.
 *
 * @param nonce      - The challenge nonce to sign.
 * @param signingKey - The Ed25519 secret key.
 */
export function signChallenge(nonce: ChallengeNonce, signingKey: SignSecretKey): Signature {
  const adapter = getSodium();
  return adapter.signDetached(nonce, signingKey);
}

/**
 * Verify a challenge signature against the expected nonce and public key.
 *
 * @returns true if the signature is valid for this nonce and public key.
 */
export function verifyChallenge(
  nonce: ChallengeNonce,
  signature: Signature,
  publicKey: SignPublicKey,
): boolean {
  const adapter = getSodium();
  return adapter.signVerifyDetached(signature, nonce, publicKey);
}
