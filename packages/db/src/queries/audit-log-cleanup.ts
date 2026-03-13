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
  const deleted = await db.delete(pgAuditLog).where(lt(pgAuditLog.timestamp, cutoff)).returning();

  return { deletedCount: deleted.length };
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
  const cutoffMs = Date.now() - options.olderThanDays * MS_PER_DAY;

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
