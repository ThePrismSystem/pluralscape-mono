/** Presigned upload URL validity window: 15 minutes in milliseconds. */
export const PRESIGNED_UPLOAD_TTL_MS = 900_000;

/**
 * Default page size for blob listing.
 *
 * Blob metadata is lightweight (no binary content in the list response),
 * so 25 items per page provides a good balance of data density and latency.
 */
export const DEFAULT_BLOB_LIMIT = 25;

/**
 * Maximum page size for blob listing.
 *
 * Caps at 100 to limit index scan cost. Blob listings join with ownership
 * metadata, so larger pages increase query time disproportionately.
 */
export const MAX_BLOB_LIMIT = 100;
