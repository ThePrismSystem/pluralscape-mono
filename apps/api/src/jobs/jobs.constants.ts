/**
 * Job-layer constants.
 * Domain: background job handlers.
 */

import { MS_PER_DAY } from "@pluralscape/types";

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

/**
 * Number of concurrent S3 DELETE requests issued per parallel sub-batch
 * when draining the cleanup queue. Twenty is a conservative cap against
 * S3's per-connection limits while still giving a ~20x speed-up over
 * the previous sequential for-loop.
 */
export const BLOB_S3_CLEANUP_PARALLEL_BATCH_SIZE = 20;

/**
 * Retention period for confirmed offline queue entries before cleanup deletes them.
 * Entries that have been successfully synced to the server are kept for 7 days
 * to allow for debugging, then permanently deleted.
 */
export const SYNC_QUEUE_RETENTION_MS = 7 * MS_PER_DAY;

/**
 * Retention period for persisted conflict records before cleanup deletes them.
 * Conflict records are kept for 90 days for auditing and debugging purposes.
 */
export const SYNC_CONFLICTS_RETENTION_MS = 90 * MS_PER_DAY;

/**
 * Maximum number of enabled timer configs to process per check-in generation run.
 * Keeps individual runs bounded to avoid timeouts on systems with many timers.
 */
export const CHECK_IN_GENERATE_BATCH_SIZE = 100;
