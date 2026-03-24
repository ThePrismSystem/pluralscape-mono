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

/** Number of random bytes for webhook HMAC signing secrets (32 bytes = 256-bit). */
export const WEBHOOK_SECRET_BYTES = 32;

/** Maximum analytics date span in milliseconds (366 days). */
export const MAX_ANALYTICS_DATE_SPAN_MS = 366 * 86_400_000;

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
