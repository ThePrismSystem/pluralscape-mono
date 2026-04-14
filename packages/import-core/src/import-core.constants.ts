/**
 * Constants for the import-core engine.
 *
 * Magic numbers extracted here per the workspace's no-magic-numbers lint rule.
 */

/** Number of source documents persisted between checkpoint writes. */
export const CHECKPOINT_CHUNK_SIZE = 50;

/** Maximum number of warnings retained per import (prevents unbounded growth). */
export const MAX_WARNING_BUFFER_SIZE = 1_000;

/** Bytes per mebibyte. */
const BYTES_PER_MIB = 1_024 * 1_024;

/**
 * Maximum permitted size of an import file (250 MiB).
 *
 * Import parsers materialise document trees in memory, so peak resident
 * usage is ~2-3x the input file size. 250 MiB keeps worst-case RSS under
 * 1 GB while comfortably covering real exports from SP and PK.
 */
export const MAX_IMPORT_FILE_BYTES = 250 * BYTES_PER_MIB;
