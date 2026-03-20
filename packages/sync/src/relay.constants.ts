/**
 * Maximum number of change envelopes stored per document before the relay
 * rejects further submissions and instructs the client to compact.
 *
 * This prevents unbounded memory growth from a single document accumulating
 * change history indefinitely without compaction.
 */
export const RELAY_MAX_ENVELOPES_PER_DOCUMENT = 10_000;
