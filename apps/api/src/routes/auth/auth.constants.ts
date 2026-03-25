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
 * Parameters must match the current server profile (t=4, m=65536, p=1).
 * Generated with: hashPassword("dummypasswordfiller", "server")
 */
export const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=4,p=1$R8XiCuEH7Vp0dU/c3DPG7g$DsumexqNIgHFu2dhin/zZci/+LwXFjSIpq2OienfAd4";

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

/** Maximum concurrent active sessions per account. Oldest session is evicted when exceeded. */
export const MAX_SESSIONS_PER_ACCOUNT = 50;

/**
 * Pad elapsed time to at least {@link ANTI_ENUM_TARGET_MS} to prevent
 * timing side-channels that distinguish real vs non-existent accounts.
 */
export async function equalizeAntiEnumTiming(startTime: number): Promise<void> {
  const elapsed = performance.now() - startTime;
  const remaining = ANTI_ENUM_TARGET_MS - elapsed;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}
