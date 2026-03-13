import { and, isNotNull, lt, sql } from "drizzle-orm";

import { syncQueue as pgSyncQueue } from "../schema/pg/sync.js";
import { syncQueue as sqliteSyncQueue } from "../schema/sqlite/sync.js";

import { MS_PER_DAY, validateOlderThanDays } from "./types.js";

import type { CleanupResult } from "./types.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Delete synced entries from the sync queue that are older than the given threshold.
 * PG variant — uses `NOW() - INTERVAL` for date arithmetic.
 *
 * When `batchSize` is provided, at most that many rows are deleted per call
 * using a ctid-based CTE. This caps lock duration and allows callers to
 * spread large purges across multiple job runs.
 */
export async function pgCleanupSyncedEntries<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  options: { olderThanDays: number; batchSize?: number },
): Promise<CleanupResult> {
  validateOlderThanDays(options.olderThanDays);
  const cutoff = sql`now() - interval '${sql.raw(String(options.olderThanDays))} days'`;

  // Use a CTE to count deleted rows without materializing them into JS memory.
  // `.returning()` would load every deleted row as a JS object, causing OOM
  // when millions of rows are purged.
  const query =
    options.batchSize !== undefined
      ? sql`WITH to_delete AS (
          SELECT ctid FROM ${pgSyncQueue}
          WHERE ${pgSyncQueue.syncedAt} IS NOT NULL
            AND ${pgSyncQueue.syncedAt} < ${cutoff}
          LIMIT ${options.batchSize}
        ), deleted AS (
          DELETE FROM ${pgSyncQueue}
          WHERE ctid IN (SELECT ctid FROM to_delete)
          RETURNING 1
        )
        SELECT count(*) AS deleted_count FROM deleted`
      : sql`WITH deleted AS (
          DELETE FROM ${pgSyncQueue}
          WHERE ${pgSyncQueue.syncedAt} IS NOT NULL
            AND ${pgSyncQueue.syncedAt} < ${cutoff}
          RETURNING 1
        )
        SELECT count(*) AS deleted_count FROM deleted`;

  const result = await db.execute<{ deleted_count: string }>(query);

  // postgres-js returns RowList (an array); pglite returns Results ({ rows: [...] })
  const row = Array.isArray(result) ? result[0] : result.rows[0];
  return { deletedCount: Number(row?.deleted_count ?? 0) };
}

/**
 * Delete synced entries from the sync queue that are older than the given threshold.
 * SQLite variant — computes epoch-ms cutoff directly.
 */
export function sqliteCleanupSyncedEntries<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, options: { olderThanDays: number }): CleanupResult {
  validateOlderThanDays(options.olderThanDays);
  const cutoffMs = Date.now() - options.olderThanDays * MS_PER_DAY;
  const result = db
    .delete(sqliteSyncQueue)
    .where(and(isNotNull(sqliteSyncQueue.syncedAt), lt(sqliteSyncQueue.syncedAt, cutoffMs)))
    .run();

  return { deletedCount: result.changes };
}
