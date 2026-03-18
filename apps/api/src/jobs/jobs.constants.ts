/**
 * Job-layer constants.
 * Domain: background job handlers.
 */

/** Number of milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

/**
 * Grace period before archived blob S3 objects are permanently deleted.
 * Allows users to restore archived blobs within 30 days without data loss.
 */
export const BLOB_S3_CLEANUP_GRACE_PERIOD_MS = 30 * MS_PER_DAY;

/**
 * Maximum number of archived blobs to process per cleanup job run.
 * Keeps individual job runs bounded to avoid timeouts on large backlogs.
 */
export const BLOB_S3_CLEANUP_BATCH_SIZE = 100;
