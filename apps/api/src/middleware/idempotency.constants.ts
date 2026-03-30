/** Valkey key prefix for idempotency cached responses. */
export const IDEMPOTENCY_KEY_PREFIX = "ps:idem:";

/** Valkey key prefix for idempotency in-flight locks. */
export const IDEMPOTENCY_LOCK_PREFIX = "ps:idem:lock:";

/** TTL for cached idempotency responses (24 hours in seconds). */
export const IDEMPOTENCY_CACHE_TTL_SEC = 86_400;

/** TTL for in-flight request locks (30 seconds). */
export const IDEMPOTENCY_LOCK_TTL_SEC = 30;

/** HTTP header name for idempotency key. */
export const IDEMPOTENCY_KEY_HEADER = "idempotency-key";

/** Maximum length for idempotency key values (UUID = 36 chars, allow some margin). */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 64;

/** Interval for periodic sweep of expired entries in the memory store (ms). */
export const IDEMPOTENCY_MEMORY_SWEEP_INTERVAL_MS = 60_000;
