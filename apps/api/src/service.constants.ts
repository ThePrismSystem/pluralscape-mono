/**
 * Shared service-layer constants.
 * Domain: all entity CRUD services.
 */

/** Maximum size of encrypted data in bytes after base64 decode (64 KiB). */
export const MAX_ENCRYPTED_DATA_BYTES = 65_536;

/** Maximum size of encrypted system data in bytes after base64 decode (98 KiB). */
export const MAX_ENCRYPTED_SYSTEM_DATA_BYTES = 98_304;

/** Default page size for list endpoints. */
export const DEFAULT_PAGE_LIMIT = 25;

/** Maximum page size for list endpoints. */
export const MAX_PAGE_LIMIT = 100;

/**
 * Maximum nesting depth for hierarchical structures (groups, structure entities).
 *
 * The ancestor walk uses this as both a cycle-detection guard and a hard depth
 * cap. Any attempt to create a parent chain deeper than 50 levels returns
 * 409 Conflict. The limit prevents pathological recursive queries while
 * exceeding any realistic organizational depth.
 *
 * See also: `docs/api-limits.md`
 */
export const MAX_ANCESTOR_DEPTH = 50;

/** Maximum number of active fronting sessions returned by the active fronting query. */
export const MAX_ACTIVE_SESSIONS = 200;

/** Maximum number of IDs in a single SQL IN clause to avoid parameter limits. */
export const MAX_IN_CLAUSE_SIZE = 500;

/** Maximum number of non-archived webhook configs per system. */
export const MAX_WEBHOOK_CONFIGS_PER_SYSTEM = 25;

/** Number of random bytes for webhook HMAC signing secrets (32 bytes = 256-bit). */
export const WEBHOOK_SECRET_BYTES = 32;

/** Maximum number of retry attempts for webhook delivery. */
export const WEBHOOK_MAX_RETRY_ATTEMPTS = 5;

/** Base backoff delay in milliseconds for webhook delivery retries. */
export const WEBHOOK_BASE_BACKOFF_MS = 1000;

/** HTTP header name for the HMAC-SHA256 webhook signature. */
export const WEBHOOK_SIGNATURE_HEADER = "X-Pluralscape-Signature";

/** HTTP header name for the delivery timestamp (Unix seconds). */
export const WEBHOOK_TIMESTAMP_HEADER = "X-Pluralscape-Timestamp";

/** Maximum age in days for terminal (success/failed) webhook deliveries before cleanup. */
export const WEBHOOK_DELIVERY_RETENTION_DAYS = 30;

/** Number of rows deleted per iteration during webhook delivery cleanup. */
export const WEBHOOK_DELIVERY_CLEANUP_BATCH_SIZE = 1_000;

// ── Webhook delivery worker ─────────────────────────────────────

/** HMAC algorithm used for signing webhook payloads. */
export const WEBHOOK_HMAC_ALGORITHM = "sha256";

/** HTTP status code threshold: 2xx is success (lower bound, inclusive). */
export const HTTP_SUCCESS_MIN = 200;

/** HTTP status code threshold: 2xx is success (upper bound, inclusive). */
export const HTTP_SUCCESS_MAX = 299;

/** Default request timeout for webhook delivery (10 seconds). */
export const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;

/** Maximum concurrent webhook deliveries per target hostname. */
export const WEBHOOK_PER_HOST_MAX_CONCURRENT = 5;

/** Delay before re-polling a delivery that was skipped due to host throttling (30 seconds). */
export const WEBHOOK_HOST_THROTTLE_DELAY_MS = 30_000;

/** Default jitter fraction for backoff (25%). */
export const WEBHOOK_DEFAULT_JITTER_FRACTION = 0.25;

/** Milliseconds per second, used to convert Date.now() to Unix seconds. */
export const MS_PER_SECOND = 1_000;

/** Required URL protocol for webhook endpoints in production. */
export const WEBHOOK_REQUIRED_PROTOCOL = "https://";

// ── Poll status literals ────────────────────────────────────────

/** Poll status: accepting votes. */
export const POLL_STATUS_OPEN = "open" as const;

/** Poll status: voting ended. */
export const POLL_STATUS_CLOSED = "closed" as const;
