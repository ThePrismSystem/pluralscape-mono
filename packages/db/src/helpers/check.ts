import { sql, type SQL } from "drizzle-orm";

import type { AnyColumn } from "drizzle-orm";

/**
 * Generate a CHECK constraint SQL fragment from a column and an array of allowed values.
 * Values are inlined via sql`${v}` which Drizzle renders as string literals in DDL context,
 * not bind parameters. Verified by integration tests that reject invalid enum values.
 */
export function enumCheck(column: AnyColumn, values: readonly string[]): SQL {
  const params = values.map((v) => sql`${v}`);
  return sql`${column} IS NULL OR ${column} IN (${sql.join(params, sql`, `)})`;
}
