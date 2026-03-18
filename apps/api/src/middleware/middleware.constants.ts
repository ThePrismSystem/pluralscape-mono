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

/** Regex pattern for valid hex-encoded session tokens (32 bytes = 64 lowercase hex chars). */
export const SESSION_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

// ── Body limit ──────────────────────────────────────────────────────

/** Maximum request body size in bytes (256 KiB). */
export const BODY_SIZE_LIMIT_BYTES = 262_144;
