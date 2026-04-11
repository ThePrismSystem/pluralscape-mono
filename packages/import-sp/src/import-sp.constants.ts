/**
 * Constants for the Simply Plural import engine.
 *
 * Magic numbers extracted here per the workspace's no-magic-numbers lint rule.
 */

/** Number of source documents persisted between checkpoint writes. */
export const CHECKPOINT_CHUNK_SIZE = 50;

/** Maximum number of retry attempts for transient SP API failures. */
export const SP_API_MAX_RETRIES = 5;

/** Base backoff delay in milliseconds for SP API retries (doubles per attempt). */
export const SP_API_BACKOFF_BASE_MS = 1_000;

/** Hard cap on backoff delay in milliseconds. */
export const SP_API_BACKOFF_MAX_MS = 16_000;

/** Default per-request timeout for SP API calls in milliseconds. */
export const SP_API_REQUEST_TIMEOUT_MS = 30_000;

/** Maximum number of warnings retained per import (prevents unbounded growth). */
export const MAX_WARNING_BUFFER_SIZE = 1_000;
