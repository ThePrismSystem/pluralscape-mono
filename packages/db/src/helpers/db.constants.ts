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

// ── PG Pool Defaults ──────────────────────────────────────────────────

/** Maximum number of connections in the postgres.js pool. */
export const PG_POOL_MAX_CONNECTIONS = 10;

/** Seconds a connection can sit idle before being released. */
export const PG_POOL_IDLE_TIMEOUT_SECONDS = 20;

/** Seconds to wait when acquiring a new connection before timing out. */
export const PG_POOL_CONNECT_TIMEOUT_SECONDS = 10;

/** Maximum lifetime of a connection in seconds (30 minutes). */
export const PG_POOL_MAX_LIFETIME_SECONDS = 1_800;

/** Maximum character length for sync document IDs (e.g., `fronting-sys_abc-2026-Q1`). */
export const DOCUMENT_ID_MAX_LENGTH = 255;
