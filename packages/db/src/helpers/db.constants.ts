/** Maximum byte size for Automerge document heads stored in the sync queue. */
export const MAX_AUTOMERGE_HEADS_BYTES = 16_384;
/** Cap on error log entries retained per system before oldest are pruned. */
export const MAX_ERROR_LOG_ENTRIES = 1_000;
/** 10 GiB (10 * 1024^3). Upper bound for blob_metadata.size_bytes. */
export const MAX_BLOB_SIZE_BYTES = 10_737_418_240;
/** Maximum character length for entity ID columns (CUID2, ULID, etc.). */
export const ID_MAX_LENGTH = 50;
/**
 * Maximum character length for enum-like varchar columns.
 * Provides headroom above the longest current enum value while still
 * catching unbounded strings.
 */
export const ENUM_MAX_LENGTH = 50;
/** Maximum length for audit log detail text. */
export const AUDIT_LOG_DETAIL_MAX_LENGTH = 2_048;
/** Maximum length for webhook/callback URLs. */
export const URL_MAX_LENGTH = 2_048;
/** Number of days to retain audit log entries before PII cleanup deletes them. */
export const AUDIT_LOG_RETENTION_DAYS = 90;
