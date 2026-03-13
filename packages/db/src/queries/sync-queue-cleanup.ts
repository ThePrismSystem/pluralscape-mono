import { and, isNotNull, lt, sql } from "drizzle-orm";

import { syncQueue as pgSyncQueue } from "../schema/pg/sync.js";
import { syncQueue as sqliteSyncQueue } from "../schema/sqlite/sync.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface CleanupResult {
  readonly deletedCount: number;
}

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

/**
 * Delete synced entries from the sync queue that are older than the given threshold.
 * PG variant — uses `NOW() - INTERVAL` for date arithmetic.
 */
export async function pgCleanupSyncedEntries<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  options: { olderThanDays: number },
): Promise<CleanupResult> {
  const cutoff = sql`now() - interval '${sql.raw(String(options.olderThanDays))} days'`;
  const deleted = await db
    .delete(pgSyncQueue)
    .where(and(isNotNull(pgSyncQueue.syncedAt), lt(pgSyncQueue.syncedAt, cutoff)))
    .returning();

  return { deletedCount: deleted.length };
}

/**
 * Delete synced entries from the sync queue that are older than the given threshold.
 * SQLite variant — computes epoch-ms cutoff directly.
 */
export function sqliteCleanupSyncedEntries<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>, options: { olderThanDays: number }): CleanupResult {
  const cutoffMs = Date.now() - options.olderThanDays * MS_PER_DAY;
  const result = db
    .delete(sqliteSyncQueue)
    .where(and(isNotNull(sqliteSyncQueue.syncedAt), lt(sqliteSyncQueue.syncedAt, cutoffMs)))
    .run();

  return { deletedCount: result.changes };
}
