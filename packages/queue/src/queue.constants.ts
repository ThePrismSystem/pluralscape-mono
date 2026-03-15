/** Default job timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Number of keys to fetch per Redis SCAN iteration. */
export const SCAN_COUNT = 100;

/** TTL in seconds for idempotency reservation keys during enqueue. */
export const IDEM_RESERVATION_TTL_SEC = 60;

/** Delay in ms added when putting back non-matching jobs during type-filtered dequeue. */
export const PUT_BACK_DELAY_MS = 100;
