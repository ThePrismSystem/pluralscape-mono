/**
 * Named constants for libsodium cryptographic operations.
 * Values match the libsodium C library specifications.
 */

// ── AEAD (XChaCha20-Poly1305 IETF) ──────────────────────────────────

/** AEAD key size in bytes (256-bit). */
export const AEAD_KEY_BYTES = 32;

/** AEAD nonce size in bytes (192-bit). */
export const AEAD_NONCE_BYTES = 24;

/** AEAD authentication tag size in bytes (128-bit). */
export const AEAD_TAG_BYTES = 16;

// ── Box (X25519 + XSalsa20-Poly1305) ────────────────────────────────

/** Box public key size in bytes. */
export const BOX_PUBLIC_KEY_BYTES = 32;

/** Box secret key size in bytes. */
export const BOX_SECRET_KEY_BYTES = 32;

/** Box nonce size in bytes. */
export const BOX_NONCE_BYTES = 24;

/** Box MAC (authentication tag) size in bytes. */
export const BOX_MAC_BYTES = 16;

/** Box seed size in bytes. */
export const BOX_SEED_BYTES = 32;

// ── Sign (Ed25519) ──────────────────────────────────────────────────

/** Sign public key size in bytes. */
export const SIGN_PUBLIC_KEY_BYTES = 32;

/** Sign secret key size in bytes. */
export const SIGN_SECRET_KEY_BYTES = 64;

/** Detached signature size in bytes. */
export const SIGN_BYTES = 64;

/** Sign seed size in bytes. */
export const SIGN_SEED_BYTES = 32;

// ── Password Hashing (Argon2id) ─────────────────────────────────────

/** Minimum recommended salt size for password hashing. */
export const PWHASH_SALT_BYTES = 16;

/** Interactive ops limit (for development/testing — faster). */
export const PWHASH_OPSLIMIT_INTERACTIVE = 2;

/** Interactive memory limit in bytes (64 MiB). */
export const PWHASH_MEMLIMIT_INTERACTIVE = 64 * 1_024 * 1_024;

/** Moderate ops limit. */
export const PWHASH_OPSLIMIT_MODERATE = 3;

/** Moderate memory limit in bytes (256 MiB). */
export const PWHASH_MEMLIMIT_MODERATE = 256 * 1_024 * 1_024;

// ── Argon2id context-specific profiles (ADR 037) ────────────────────
//
// Rationale: a single unified profile either over-pays on short-lived
// derivations (like the device-transfer key) or under-protects long-lived
// ones (like the master-key wrap). Each profile bundles (opslimit, memlimit)
// indivisibly so callers can't accidentally mix tiers.
//
// Numbers follow the OWASP ASVS 4.x V2.4 / Password Storage Cheat Sheet
// guidance for Argon2id with parallelism = 1 (libsodium's hard-coded value).

/** Argon2id profile shape — opslimit and memlimit travel together. */
export interface Argon2idProfile {
  /** libsodium pwhash opslimit (iterations). */
  readonly opslimit: number;
  /** libsodium pwhash memlimit in bytes. */
  readonly memlimit: number;
}

/**
 * MASTER_KEY — long-lived derivations that protect the account for the
 * lifetime of the password. Used by auth-key split derivation and PIN
 * hashing. (t=4, m=64 MiB) exceeds the OWASP high-memory recommendation
 * (m >= 64 MiB, t >= 3) and matches the previous unified profile, so
 * existing dev artifacts remain compatible.
 */
export const ARGON2ID_PROFILE_MASTER_KEY: Argon2idProfile = Object.freeze({
  opslimit: 4,
  memlimit: 64 * 1_024 * 1_024,
});

/**
 * TRANSFER — one-shot KDF for device-transfer sessions. The source input is
 * a 10-digit code (~33.2 bits of entropy) protected by a 5-minute server-side
 * timeout and rate limiting (ADR 024). (t=3, m=32 MiB) still comfortably
 * exceeds the OWASP minimum (m >= 19 MiB, t >= 2) while materially improving
 * pair-a-new-device latency on low-end mobile hardware.
 */
export const ARGON2ID_PROFILE_TRANSFER: Argon2idProfile = Object.freeze({
  opslimit: 3,
  memlimit: 32 * 1_024 * 1_024,
});

/** Output length for split key derivation: auth_key (32B) + password_key (32B). */
export const SPLIT_KEY_BYTES = 64;

/** Size of auth_key in bytes (first half of split derivation). */
export const AUTH_KEY_BYTES = 32;

/** Size of password_key in bytes (second half of split derivation). */
export const PASSWORD_KEY_BYTES = 32;

/** BLAKE2B output length for auth key hashing (256 bits). */
export const AUTH_KEY_HASH_BYTES = 32;

/** BLAKE2B output length for recovery key hashing (256 bits). */
export const RECOVERY_KEY_HASH_BYTES = 32;

/** Size of challenge nonce in bytes (256 bits). */
export const CHALLENGE_NONCE_BYTES = 32;

/** Minimum encrypted blob size in bytes: nonce (24B) + tag (16B) = 40B. */
export const ENCRYPTED_BLOB_MIN_BYTES = 40;

// ── KDF (BLAKE2B) ───────────────────────────────────────────────────

/** KDF key size in bytes. */
export const KDF_KEY_BYTES = 32;

/** KDF context size in bytes (must be exactly 8 bytes). */
export const KDF_CONTEXT_BYTES = 8;

/** Minimum derived sub-key size in bytes. */
export const KDF_BYTES_MIN = 16;

/** Maximum derived sub-key size in bytes. */
export const KDF_BYTES_MAX = 64;

// ── Generic Hash (BLAKE2b) ───────────────────────────────────────────

/** Minimum output length for BLAKE2b generic hash, in bytes. */
export const GENERIC_HASH_BYTES_MIN = 16;

/** Maximum output length for BLAKE2b generic hash, in bytes. */
export const GENERIC_HASH_BYTES_MAX = 64;

// ── Password Validation ─────────────────────────────────────────────

/** Minimum password length enforced at the application layer. */
export const MIN_PASSWORD_LENGTH = 8;

// ── Safety Number ────────────────────────────────────────────────────

/** Version tag prepended to safety number fingerprint inputs. */
export const SAFETY_NUMBER_VERSION = 1;

/**
 * Number of BLAKE2b iterations used to compute a safety number fingerprint.
 *
 * Inspired by the Signal protocol's safety number design, which uses 5200
 * iterations of SHA-512. This implementation substitutes BLAKE2b for SHA-512
 * but retains the same iteration count for comparable computational cost.
 */
export const SAFETY_NUMBER_ITERATIONS = 5200;

/** Output length in bytes for each user's fingerprint before digit encoding. */
export const SAFETY_NUMBER_HASH_BYTES = 30;

// ── Hex Encoding ────────────────────────────────────────────────────

/** Radix for hexadecimal parsing/formatting. */
export const HEX_RADIX = 16;

/** Number of hex characters per byte (each byte = 2 hex digits). */
export const HEX_CHARS_PER_BYTE = 2;

/** All sodium constants as a single frozen object. */
export const SODIUM_CONSTANTS = Object.freeze({
  AEAD_KEY_BYTES,
  AEAD_NONCE_BYTES,
  AEAD_TAG_BYTES,
  BOX_PUBLIC_KEY_BYTES,
  BOX_SECRET_KEY_BYTES,
  BOX_NONCE_BYTES,
  BOX_MAC_BYTES,
  BOX_SEED_BYTES,
  SIGN_PUBLIC_KEY_BYTES,
  SIGN_SECRET_KEY_BYTES,
  SIGN_BYTES,
  SIGN_SEED_BYTES,
  PWHASH_SALT_BYTES,
  PWHASH_OPSLIMIT_INTERACTIVE,
  PWHASH_MEMLIMIT_INTERACTIVE,
  PWHASH_OPSLIMIT_MODERATE,
  PWHASH_MEMLIMIT_MODERATE,
  KDF_KEY_BYTES,
  KDF_CONTEXT_BYTES,
  KDF_BYTES_MIN,
  KDF_BYTES_MAX,
  GENERIC_HASH_BYTES_MIN,
  GENERIC_HASH_BYTES_MAX,
  ARGON2ID_PROFILE_MASTER_KEY,
  ARGON2ID_PROFILE_TRANSFER,
  SPLIT_KEY_BYTES,
  AUTH_KEY_BYTES,
  PASSWORD_KEY_BYTES,
  AUTH_KEY_HASH_BYTES,
  RECOVERY_KEY_HASH_BYTES,
  CHALLENGE_NONCE_BYTES,
  ENCRYPTED_BLOB_MIN_BYTES,
} as const);
