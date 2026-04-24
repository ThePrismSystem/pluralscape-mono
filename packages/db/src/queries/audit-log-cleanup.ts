import { toUnixMillis } from "@pluralscape/types";
import { lt, sql } from "drizzle-orm";

import { auditLog as pgAuditLog } from "../schema/pg/audit-log.js";
import { auditLog as sqliteAuditLog } from "../schema/sqlite/audit-log.js";

import { MS_PER_DAY, validateOlderThanDays } from "./types.js";

import type { CleanupResult } from "./types.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Delete audit log entries older than the given threshold.
 * PG variant — for partitioned tables, consider detaching/dropping partitions
 * at the operational level; this function handles row-level cleanup.
 */
export async function pgCleanupAuditLog<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  options: { olderThanDays: number },
): Promise<CleanupResult> {
  validateOlderThanDays(options.olderThanDays);
  const cutoff = sql`now() - interval '${sql.raw(String(options.olderThanDays))} days'`;

  // Use a CTE to count deleted rows without materializing them into JS memory.
  // `.returning()` would load every deleted row as a JS object, causing OOM
  // when millions of rows are purged.
  const result = await db.execute<{ deleted_count: string }>(
    sql`WITH deleted AS (
      DELETE FROM ${pgAuditLog}
      WHERE ${pgAuditLog.timestamp} < ${cutoff}
      RETURNING 1
    )
    SELECT count(*) AS deleted_count FROM deleted`,
  );

  // postgres-js returns RowList (an array); pglite returns Results ({ rows: [...] })
  const row = Array.isArray(result) ? result[0] : result.rows[0];
  return { deletedCount: Number(row?.deleted_count ?? 0) };
}

/**
 * Delete audit log entries older than the given threshold.
 * SQLite variant — uses batch-size DELETE to avoid long-running transactions.
 */
export function sqliteCleanupAuditLog<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: BetterSQLite3Database<TSchema>,
  options: { olderThanDays: number; batchSize?: number },
): CleanupResult {
  validateOlderThanDays(options.olderThanDays);
  const cutoffMs = toUnixMillis(Date.now() - options.olderThanDays * MS_PER_DAY);

  if (options.batchSize !== undefined && options.batchSize > 0) {
    // Batch delete: delete up to batchSize rows per invocation
    const result = db.run(
      sql`DELETE FROM ${sqliteAuditLog} WHERE rowid IN (
        SELECT rowid FROM ${sqliteAuditLog}
        WHERE ${sqliteAuditLog.timestamp} < ${cutoffMs}
        LIMIT ${options.batchSize}
      )`,
    );
    return { deletedCount: result.changes };
  }

  const result = db.delete(sqliteAuditLog).where(lt(sqliteAuditLog.timestamp, cutoffMs)).run();
  return { deletedCount: result.changes };
}
