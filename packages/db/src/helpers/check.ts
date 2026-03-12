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
  if (values.length === 0) {
    throw new Error("enumCheck requires at least one value");
  }
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
  return sql`(${archivedCol} = true) = (${archivedAtCol} IS NOT NULL)`;
}

/** CHECK: two nullable columns must be NULL together or non-NULL together. */
export function nullPairCheck(colA: AnyColumn, colB: AnyColumn): SQL {
  return sql`(${colA} IS NULL) = (${colB} IS NULL)`;
}
