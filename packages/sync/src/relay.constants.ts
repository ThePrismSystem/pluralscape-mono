import { MiB } from "./sync.constants.js";

/**
 * Maximum number of change envelopes stored per document before the relay
 * rejects further submissions and instructs the client to compact.
 *
 * This prevents unbounded memory growth from a single document accumulating
 * change history indefinitely without compaction.
 */
export const RELAY_MAX_ENVELOPES_PER_DOCUMENT = 10_000;

/**
 * Default maximum size in bytes for a single snapshot ciphertext.
 *
 * Snapshots beyond this size are rejected to prevent memory exhaustion
 * from oversized blobs. 50 MiB is well above the largest document
 * size limit (journal at 50 MiB) and accounts for AEAD overhead.
 */
export const RELAY_MAX_SNAPSHOT_SIZE_BYTES = 50 * MiB;
