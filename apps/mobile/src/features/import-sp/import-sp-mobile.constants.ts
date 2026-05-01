/**
 * Constants for the mobile-side Simply Plural import glue.
 *
 * Magic numbers extracted here per the workspace's no-magic-numbers lint rule.
 * All values chosen to balance throughput, memory, and SP API politeness on
 * mobile hardware where background execution is limited.
 */

/**
 * Maximum number of entity ref rows persisted per `importRef.upsertBatch` call.
 *
 * Matches `CHECKPOINT_CHUNK_SIZE` on the engine side so the mobile persister
 * can flush one chunk per round trip without client-side re-batching.
 */
export const PERSISTER_REF_BATCH_SIZE = 50;

/**
 * Maximum number of avatar fetches in flight at any time.
 *
 * Tuned for mobile networks where too much parallelism triggers backpressure
 * on the SP CDN and drains battery. Four matches what other import clients
 * use for parallel small-asset downloads.
 */
export const AVATAR_CONCURRENCY = 4;

/**
 * Per-request timeout for avatar fetches in milliseconds.
 *
 * Avatars are small (< 5 MB) but must complete quickly so the progress UI
 * does not stall. Thirty seconds leaves headroom for slow 3G links before
 * the AbortController tears the request down.
 */
export const AVATAR_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Hard cap on avatar payload size in bytes.
 *
 * Five megabytes is well above SP's documented avatar size ceiling and
 * prevents a malicious or mis-served payload from exhausting mobile memory.
 */
export const AVATAR_MAX_BYTES = 5_000_000;

/**
 * Polling interval for import progress updates in milliseconds.
 *
 * 1.5 seconds gives a responsive UI without hammering the progress store;
 * import operations typically take tens of seconds to minutes so more
 * frequent polls provide no perceptible benefit.
 */
export const IMPORT_PROGRESS_POLL_INTERVAL_MS = 1_500;

/**
 * SecureStore key prefix for persisted SP API tokens.
 *
 * Tokens are namespaced per system id so a device hosting multiple systems
 * can preserve each system's import credential independently.
 */
export const SP_TOKEN_KEY_PREFIX = "pluralscape_sp_token_";

/** Encryption tier for avatar blobs (tier 1 = system-key encrypted). */
export const AVATAR_ENCRYPTION_TIER = 1;
