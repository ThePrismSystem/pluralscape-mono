/** Default job timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Number of keys to fetch per Redis SCAN iteration. */
export const SCAN_COUNT = 100;

/** TTL in seconds for idempotency reservation keys during enqueue. */
export const IDEM_RESERVATION_TTL_SEC = 60;

/** Delay in ms added when putting back non-matching jobs during type-filtered dequeue. */
export const PUT_BACK_DELAY_MS = 100;

/** Maximum number of jobs to inspect per dequeue call when filtering by type. */
export const MAX_DEQUEUE_BATCH = 20;

/** Base delay in ms for exponential poll backoff after consecutive failures. */
export const POLL_BACKOFF_BASE_MS = 100;

/** Maximum delay in ms for poll backoff. */
export const MAX_POLL_BACKOFF_MS = 30_000;

/** Calculates backoff delay for poll failures using exponential backoff with cap. */
export function pollBackoffMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return 0;
  return Math.min(POLL_BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1), MAX_POLL_BACKOFF_MS);
}
