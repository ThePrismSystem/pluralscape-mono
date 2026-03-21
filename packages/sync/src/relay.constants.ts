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
 * Defaults to Infinity (no limit) for backward compatibility.
 * Set a finite value via `RelayOptions.maxSnapshotSizeBytes` to cap
 * memory usage from large snapshot blobs.
 */
export const RELAY_MAX_SNAPSHOT_SIZE_BYTES = Infinity;
