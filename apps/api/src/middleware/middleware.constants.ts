/** CORS preflight cache duration (1 day). */
export const CORS_MAX_AGE_SECONDS = 86_400;

/** HSTS max-age directive (2 years = 730 × CORS_MAX_AGE_SECONDS). */
export const HSTS_MAX_AGE_SECONDS = CORS_MAX_AGE_SECONDS * 730;

// ── Rate limiter ─────────────────────────────────────────────────────

/** Milliseconds in one second, used for rate-limiter window conversions. */
export const MS_PER_SECOND = 1_000;
/** Evict expired entries when the in-memory store exceeds this size. */
export const MAX_RATE_LIMIT_ENTRIES = 10_000;

// ── Session token format ────────────────────────────────────────────

/** Expected prefix for session tokens. */
export const SESSION_TOKEN_PREFIX = "sess_";

/** Expected length of session tokens (5-char prefix + 36-char UUID). */
export const SESSION_TOKEN_LENGTH = 41;

// ── Body limit ──────────────────────────────────────────────────────

/** Maximum request body size in bytes (256 KiB). */
export const BODY_SIZE_LIMIT_BYTES = 262_144;
