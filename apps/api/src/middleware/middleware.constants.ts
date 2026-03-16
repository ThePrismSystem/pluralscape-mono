/** CORS preflight cache duration (1 day). */
export const CORS_MAX_AGE_SECONDS = 86_400;

/** HSTS max-age directive (2 years = 730 × CORS_MAX_AGE_SECONDS). */
export const HSTS_MAX_AGE_SECONDS = CORS_MAX_AGE_SECONDS * 730;

// ── HTTP status codes ────────────────────────────────────────────────

/** HTTP 403 Forbidden — request understood but refused. */
export const HTTP_FORBIDDEN = 403;
/** HTTP 429 Too Many Requests — rate limit exceeded. */
export const HTTP_TOO_MANY_REQUESTS = 429;
/** HTTP 500 Internal Server Error — unexpected server failure. */
export const HTTP_INTERNAL_SERVER_ERROR = 500;

// ── Rate limiter ─────────────────────────────────────────────────────

/** Milliseconds in one second, used for rate-limiter window conversions. */
export const MS_PER_SECOND = 1_000;
/** Evict expired entries when the in-memory store exceeds this size. */
export const MAX_RATE_LIMIT_ENTRIES = 10_000;
