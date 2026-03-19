/**
 * Auth-specific constants.
 * Domain: authentication routes and service layer.
 */

// ── Auth Configuration ─────────────────────────────────────────────

/** Generic error message for login failures — prevents user enumeration. */
export const AUTH_GENERIC_LOGIN_ERROR = "Invalid email or password";

/** Header name for client platform hints (web/mobile). */
export const CLIENT_PLATFORM_HEADER = "x-client-platform";

/** Valid platform values for session TTL selection. */
export const VALID_PLATFORMS = ["web", "mobile"] as const;

/** Derived type for valid client platform values. */
export type ClientPlatform = (typeof VALID_PLATFORMS)[number];

/** Default platform when header is missing or unrecognized. */
export const DEFAULT_PLATFORM = "web" as const satisfies ClientPlatform;

/**
 * Dummy Argon2id hash for anti-timing attacks on login.
 * Used when the email is not found — we run verification against this
 * to equalize timing with real account lookups.
 * Generated with: hashPassword("dummypasswordfiller", "server")
 */
export const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$R8XiCuEH7Vp0dU/c3DPG7g$DsumexqNIgHFu2dhin/zZci/+LwXFjSIpq2OienfAd4";

/** Length of random email salt in bytes. */
export const EMAIL_SALT_BYTES = 16;

/** BLAKE2b output length for email hashing (256 bits = 32 bytes). */
export const EMAIL_HASH_LENGTH = 32;

/** Default page size for session listing. */
export const DEFAULT_SESSION_LIMIT = 25;

/** Maximum page size for session listing. */
export const MAX_SESSION_LIMIT = 100;

/** Number of groups in a fake recovery key. */
export const RECOVERY_KEY_GROUP_COUNT = 13;

/** Characters per group in a recovery key. */
export const RECOVERY_KEY_GROUP_SIZE = 4;

/** Target registration time (ms) for anti-enumeration timing equalization. */
export const ANTI_ENUM_TARGET_MS = 500;

/** Expected length of EMAIL_HASH_PEPPER hex string (32 bytes = 64 hex chars). */
export const PEPPER_HEX_LENGTH = 64;
