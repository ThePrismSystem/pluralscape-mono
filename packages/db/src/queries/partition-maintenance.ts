import { extractErrorMessage } from "@pluralscape/types";
import { sql } from "drizzle-orm";

import { validateMonthsAhead, validateOlderThanMonths } from "./types.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Tables managed via range partitioning on a timestamp column. */
export const PARTITIONED_TABLES = ["messages", "audit_log", "fronting_sessions"] as const;

export type PartitionedTable = (typeof PARTITIONED_TABLES)[number];

/** Bounds for the year/month runtime guard on formatPartitionName. */
const MIN_PARTITION_YEAR = 2000;
const MAX_PARTITION_YEAR = 9999;
const MAX_PARTITION_MONTH = 12;

/**
 * Only audit_log partitions may be destructively detached.
 * Messages and fronting_sessions are retained until
 * explicitly deleted by the user or account deletion.
 */
export type DetachableTable = "audit_log";

/**
 * Formats a partition table name from its parent table, year, and month.
 *
 * Example: formatPartitionName("audit_log", 2026, 3) → "audit_log_2026_03"
 *
 * Validates all three inputs at runtime even though TypeScript narrows
 * `table` — a JS caller or future refactor could bypass the type system,
 * and this identifier flows into `sql.raw` downstream. The year/month
 * bounds also keep the formatted name free of negative numbers, floats,
 * or other unexpected characters.
 */
export function formatPartitionName(table: PartitionedTable, year: number, month: number): string {
  if (!PARTITIONED_TABLES.includes(table)) {
    throw new Error(`Invalid partitioned table: ${table as string}`);
  }
  if (!Number.isInteger(year) || year < MIN_PARTITION_YEAR || year > MAX_PARTITION_YEAR) {
    throw new Error(`Invalid partition year: ${String(year)}`);
  }
  if (!Number.isInteger(month) || month < 1 || month > MAX_PARTITION_MONTH) {
    throw new Error(`Invalid partition month: ${String(month)}`);
  }
  return `${table}_${String(year)}_${String(month).padStart(2, "0")}`;
}

export interface ParsedPartitionDate {
  readonly year: number;
  readonly month: number;
}

/**
 * Parses the year and month from a partition table name.
 * Returns null for the default partition or any name that doesn't match
 * the `<table>_YYYY_MM` pattern.
 */
export function parsePartitionDate(partitionName: string): ParsedPartitionDate | null {
  const match = /^.+_(\d{4})_(\d{2})$/.exec(partitionName);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

/**
 * Ensure monthly partitions exist for each partitioned table from the
 * current month through `monthsAhead` months into the future.
 *
 * Uses `CREATE TABLE IF NOT EXISTS … PARTITION OF` so it is safe to
 * call repeatedly (e.g. from a scheduled job).
 */
export async function pgEnsureFuturePartitions<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  options: { monthsAhead: number },
): Promise<void> {
  validateMonthsAhead(options.monthsAhead);
  const now = new Date();
  for (let i = 0; i <= options.monthsAhead; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const nextDate = new Date(year, month, 1); // first of next month
    const from = `${String(year)}-${String(month).padStart(2, "0")}-01`;
    const to = `${String(nextDate.getFullYear())}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`;
    for (const table of PARTITIONED_TABLES) {
      const partitionName = formatPartitionName(table, year, month);
      await db.execute(
        sql`CREATE TABLE IF NOT EXISTS ${sql.raw(`"${partitionName}"`)} PARTITION OF ${sql.raw(`"${table}"`)} FOR VALUES FROM (${from}::timestamptz) TO (${to}::timestamptz)`,
      );
    }
  }
}

export interface DetachResult {
  readonly detachedCount: number;
  readonly errors: ReadonlyArray<{ partitionName: string; error: string }>;
}

/**
 * Detach and drop audit_log monthly partitions older than `olderThanMonths`.
 *
 * Restricted to audit_log only — messages and fronting_sessions
 * partitions are never dropped automatically.
 *
 * Queries pg_inherits + pg_class to find child partitions, parses their
 * names, and issues DETACH + DROP for those past the retention cutoff.
 */
export async function pgDetachOldPartitions<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>,
  options: { table: DetachableTable; olderThanMonths: number },
): Promise<DetachResult> {
  validateOlderThanMonths(options.olderThanMonths);
  const result = await db.execute<{ partition_name: string }>(
    sql`SELECT c.relname AS partition_name
        FROM pg_inherits i
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_class c ON c.oid = i.inhrelid
        WHERE p.relname = ${options.table}`,
  );

  const rows = Array.isArray(result) ? result : result.rows;

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - options.olderThanMonths);

  let detachedCount = 0;
  const errors: Array<{ partitionName: string; error: string }> = [];
  for (const { partition_name } of rows) {
    const parsed = parsePartitionDate(partition_name);
    if (!parsed) continue;
    const partitionDate = new Date(parsed.year, parsed.month - 1, 1);
    if (partitionDate < cutoff) {
      // SECURITY: Never feed the raw partition_name from pg_inherits into sql.raw.
      // Reconstruct the identifier from validated numeric components so a compromised
      // catalog cannot smuggle arbitrary SQL through the DDL statement.
      const safeName = formatPartitionName(options.table, parsed.year, parsed.month);
      try {
        await db.execute(
          sql`ALTER TABLE ${sql.raw(`"${options.table}"`)} DETACH PARTITION ${sql.raw(`"${safeName}"`)}`,
        );
        await db.execute(sql`DROP TABLE ${sql.raw(`"${safeName}"`)}`);
        detachedCount++;
      } catch (err: unknown) {
        errors.push({ partitionName: safeName, error: extractErrorMessage(err) });
      }
    }
  }
  return { detachedCount, errors };
}
