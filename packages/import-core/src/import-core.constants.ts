/**
 * Constants for the import-core engine.
 *
 * Magic numbers extracted here per the workspace's no-magic-numbers lint rule.
 */

/** Number of source documents persisted between checkpoint writes. */
export const CHECKPOINT_CHUNK_SIZE = 50;

/** Maximum number of warnings retained per import (prevents unbounded growth). */
export const MAX_WARNING_BUFFER_SIZE = 1_000;
