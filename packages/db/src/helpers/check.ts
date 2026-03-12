import { sql, type SQL } from "drizzle-orm";

import type { AnyColumn } from "drizzle-orm";

/**
 * Generate a CHECK constraint SQL fragment from a column and an array of allowed values.
 * Values are inlined via sql`${v}` which Drizzle renders as string literals in DDL context,
 * not bind parameters. Verified by integration tests that reject invalid enum values.
 *
 * The `IS NULL` branch is intentional: nullable enum columns must pass the CHECK
 * when the value is NULL. For `notNull()` columns the branch is a no-op — presence
 * is enforced by the NOT NULL constraint, not the CHECK.
 */
export function enumCheck(column: AnyColumn, values: readonly string[]): SQL {
  const params = values.map((v) => sql`${v}`);
  return sql`${column} IS NULL OR ${column} IN (${sql.join(params, sql`, `)})`;
}

/** CHECK constraint: version >= 1. Pair with `versioned()` helper columns. */
export function versionCheck(versionCol: AnyColumn): SQL {
  return sql`${versionCol} >= 1`;
}

/**
 * CHECK constraint: archived flag and archivedAt timestamp must be consistent.
 * `archived = true` iff `archivedAt IS NOT NULL`.
 * Pair with `archivable()` helper columns.
 */
export function archivableConsistencyCheck(archivedCol: AnyColumn, archivedAtCol: AnyColumn): SQL {
  return sql`CASE WHEN ${archivedCol} THEN (${archivedAtCol} IS NOT NULL) ELSE (${archivedAtCol} IS NULL) END`;
}
