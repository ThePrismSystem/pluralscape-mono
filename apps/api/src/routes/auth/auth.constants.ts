/**
 * Auth-specific constants.
 * Domain: authentication routes and service layer.
 */

// ── Auth Configuration ─────────────────────────────────────────────

/** Generic error message for login failures — prevents user enumeration. */
export const AUTH_GENERIC_LOGIN_ERROR = "Invalid email or credentials";

/** Header name for client platform hints (web/mobile). */
export const CLIENT_PLATFORM_HEADER = "x-client-platform";

/** Valid platform values for session TTL selection. */
export const VALID_PLATFORMS = ["web", "mobile"] as const;

/** Derived type for valid client platform values. */
export type ClientPlatform = (typeof VALID_PLATFORMS)[number];

/** Default platform when header is missing or unrecognized. */
export const DEFAULT_PLATFORM = "web" as const satisfies ClientPlatform;

/**
 * Minimum length required for a production ANTI_ENUM_SALT_SECRET value.
 *
 * 32 bytes of entropy is sufficient collision-resistance for the BLAKE2B
 * keyed hash that produces the anti-enumeration fake salt.
 */
export const ANTI_ENUM_SALT_SECRET_MIN_LENGTH = 32;

/** Challenge nonce TTL in milliseconds (5 minutes). */
export const CHALLENGE_NONCE_TTL_MS = 5 * 60 * 1_000;

/** Length of random email salt in bytes. */
export const EMAIL_SALT_BYTES = 16;

/** BLAKE2b output length for email hashing (256 bits = 32 bytes). */
export const EMAIL_HASH_LENGTH = 32;

/**
 * Default page size for session listing.
 *
 * Users rarely have more than a handful of active sessions. A default of 25
 * ensures the session management UI loads all sessions in a single request.
 */
export const DEFAULT_SESSION_LIMIT = 25;

/**
 * Maximum page size for session listing.
 *
 * Capped at 100 to align with the global pagination maximum. Session
 * listing includes IP and user-agent metadata, so large pages increase
 * response payload significantly.
 */
export const MAX_SESSION_LIMIT = 100;

/** Number of groups in a fake recovery key. */
export const RECOVERY_KEY_GROUP_COUNT = 13;

/** Characters per group in a recovery key. */
export const RECOVERY_KEY_GROUP_SIZE = 4;

/** Target time (ms) for anti-enumeration timing equalization. */
export const ANTI_ENUM_TARGET_MS = 500;

/** Expected length of EMAIL_HASH_PEPPER hex string (32 bytes = 64 hex chars). */
export const PEPPER_HEX_LENGTH = 64;

// Production fail-closed check for ANTI_ENUM_SALT_SECRET is enforced
// centrally by env.ts (Zod schema refuses boot if unset or too short).
