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

/** Sensitive ops limit (OWASP minimum for server-side password hashing). */
export const PWHASH_OPSLIMIT_SENSITIVE = 4;

/** Mobile ops limit (for memory-constrained devices). */
export const PWHASH_OPSLIMIT_MOBILE = 2;

/** Mobile memory limit in bytes (32 MiB — OWASP Mobile minimum). */
export const PWHASH_MEMLIMIT_MOBILE = 32 * 1_024 * 1_024;

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
 * Follows the Signal protocol's safety number specification: 5200 iterations
 * ensures sufficient computational cost for fingerprint derivation while
 * remaining fast enough for interactive use.
 *
 * @see https://signal.org/docs/specifications/safety-number/
 */
export const SAFETY_NUMBER_ITERATIONS = 5200;

/** Output length in bytes for each user's fingerprint before digit encoding. */
export const SAFETY_NUMBER_HASH_BYTES = 30;

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
  PWHASH_OPSLIMIT_SENSITIVE,
  PWHASH_OPSLIMIT_MOBILE,
  PWHASH_MEMLIMIT_MOBILE,
  KDF_KEY_BYTES,
  KDF_CONTEXT_BYTES,
  KDF_BYTES_MIN,
  KDF_BYTES_MAX,
  GENERIC_HASH_BYTES_MIN,
  GENERIC_HASH_BYTES_MAX,
} as const);
