import { blobMetadata } from "@pluralscape/db/pg";
import { and, eq, inArray, lt } from "drizzle-orm";

import { logger } from "../lib/logger.js";

import {
  BLOB_S3_CLEANUP_BATCH_SIZE,
  BLOB_S3_CLEANUP_GRACE_PERIOD_MS,
  BLOB_S3_CLEANUP_PARALLEL_BATCH_SIZE,
} from "./jobs.constants.js";

import type { JobHandler } from "@pluralscape/queue";
import type { BlobStorageAdapter } from "@pluralscape/storage";
import type { StorageKey } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface BlobRow {
  readonly id: string;
  readonly storageKey: string;
}

/**
 * Issue S3 deletes for a sub-batch in parallel with `Promise.allSettled` so
 * one poison blob doesn't stall the rest of the batch. Returns the ids that
 * succeeded; fulfilled without throwing. Failures are logged but not thrown
 * so the caller can continue with metadata deletion for the successful ids.
 */
async function deleteSubBatch(
  rows: readonly BlobRow[],
  storageAdapter: BlobStorageAdapter,
): Promise<readonly string[]> {
  const results = await Promise.allSettled(
    rows.map(async (row) => {
      await storageAdapter.delete(row.storageKey as StorageKey);
      return row.id;
    }),
  );

  const deletedIds: string[] = [];
  results.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      deletedIds.push(result.value);
      return;
    }
    const row = rows[idx];
    // row is guaranteed present: results.length === rows.length
    const error: unknown = result.reason;
    logger.warn("Failed to delete S3 object for blob", {
      blobId: row?.id,
      ...(error instanceof Error ? { err: error } : { error: String(error) }),
    });
  });
  return deletedIds;
}

/**
 * Creates a job handler for the `blob-cleanup` job type.
 *
 * Finds blobs that have been archived for longer than the grace period,
 * deletes their S3 objects via the storage adapter in parallel sub-batches
 * (Promise.allSettled), then hard-deletes the metadata rows from the
 * database for every successful deletion.
 */
export function createBlobS3CleanupHandler(
  db: PostgresJsDatabase,
  storageAdapter: BlobStorageAdapter,
): JobHandler<"blob-cleanup"> {
  return async (_job, ctx) => {
    if (ctx.signal.aborted) return;

    const cutoff = Date.now() - BLOB_S3_CLEANUP_GRACE_PERIOD_MS;

    // Find archived blobs past the grace period
    const rows = await db
      .select({ id: blobMetadata.id, storageKey: blobMetadata.storageKey })
      .from(blobMetadata)
      .where(and(eq(blobMetadata.archived, true), lt(blobMetadata.archivedAt, cutoff)))
      .limit(BLOB_S3_CLEANUP_BATCH_SIZE);

    if (rows.length === 0) return;

    // Walk the batch in parallel sub-batches. One heartbeat per sub-batch
    // rather than per-row keeps the heartbeat cadence sensible while the
    // parallelism gives us a ~20x speed-up over the previous sequential
    // for-loop. Re-check the abort signal through a local accessor so the
    // compiler doesn't narrow it to `false` from the top-of-function check.
    const signal: AbortSignal = ctx.signal;
    const allDeletedIds: string[] = [];
    for (let i = 0; i < rows.length; i += BLOB_S3_CLEANUP_PARALLEL_BATCH_SIZE) {
      if (signal.aborted) break;
      const subBatch = rows.slice(i, i + BLOB_S3_CLEANUP_PARALLEL_BATCH_SIZE);
      const deletedIds = await deleteSubBatch(subBatch, storageAdapter);
      allDeletedIds.push(...deletedIds);
      await ctx.heartbeat.heartbeat();
    }

    // Hard-delete metadata rows for successfully purged blobs
    if (allDeletedIds.length > 0) {
      await db.delete(blobMetadata).where(inArray(blobMetadata.id, allDeletedIds));
    }
  };
}
