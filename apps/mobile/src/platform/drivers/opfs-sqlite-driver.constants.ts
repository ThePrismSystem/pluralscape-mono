/**
 * OPFS driver timeouts. CALL_TIMEOUT_MS is generous enough for large blob
 * writes under OPFS lock contention while still catching true worker hangs.
 * Override via OpfsSqliteDriverOptions.callTimeoutMs (null = disabled).
 */

export const INIT_TIMEOUT_MS = 5_000;
export const CALL_TIMEOUT_MS = 30_000;
