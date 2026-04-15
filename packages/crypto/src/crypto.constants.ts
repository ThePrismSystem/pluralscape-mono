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

/** Unified Argon2id ops limit — OWASP Sensitive tier (t=4). All clients use this. */
export const PWHASH_OPSLIMIT_UNIFIED = 4;

/** Unified Argon2id memory limit in bytes (64 MiB). All clients use this. */
export const PWHASH_MEMLIMIT_UNIFIED = 64 * 1_024 * 1_024;

/** Output length for split key derivation: auth_key (32B) + password_key (32B). */
export const SPLIT_KEY_BYTES = 64;

/** Size of auth_key in bytes (first half of split derivation). */
export const AUTH_KEY_BYTES = 32;

/** Size of password_key in bytes (second half of split derivation). */
export const PASSWORD_KEY_BYTES = 32;

/** BLAKE2B output length for auth key hashing (256 bits). */
export const AUTH_KEY_HASH_BYTES = 32;

/** Size of challenge nonce in bytes (256 bits). */
export const CHALLENGE_NONCE_BYTES = 32;

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
  PWHASH_OPSLIMIT_SENSITIVE,
  PWHASH_OPSLIMIT_MOBILE,
  PWHASH_MEMLIMIT_MOBILE,
  KDF_KEY_BYTES,
  KDF_CONTEXT_BYTES,
  KDF_BYTES_MIN,
  KDF_BYTES_MAX,
  GENERIC_HASH_BYTES_MIN,
  GENERIC_HASH_BYTES_MAX,
  PWHASH_OPSLIMIT_UNIFIED,
  PWHASH_MEMLIMIT_UNIFIED,
  SPLIT_KEY_BYTES,
  AUTH_KEY_BYTES,
  PASSWORD_KEY_BYTES,
  AUTH_KEY_HASH_BYTES,
  CHALLENGE_NONCE_BYTES,
} as const);
