/** CORS preflight cache duration (1 day). */
export const CORS_MAX_AGE_SECONDS = 86_400;

/** HSTS max-age directive (2 years). */
export const HSTS_MAX_AGE_SECONDS = 63_072_000;

// ── HTTP status codes ────────────────────────────────────────────────

export const HTTP_FORBIDDEN = 403;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_INTERNAL_SERVER_ERROR = 500;

// ── Rate limiter ─────────────────────────────────────────────────────

export const MS_PER_SECOND = 1_000;
/** Evict expired entries when the in-memory store exceeds this size. */
export const MAX_RATE_LIMIT_ENTRIES = 10_000;
