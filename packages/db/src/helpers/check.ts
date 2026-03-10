import { sql, type SQL } from "drizzle-orm";

import type { AnyColumn } from "drizzle-orm";

/** Generate a CHECK constraint SQL fragment from a column and an array of allowed values. */
export function enumCheck(column: AnyColumn, values: readonly string[]): SQL {
  const params = values.map((v) => sql`${v}`);
  return sql`${column} IN (${sql.join(params, sql`, `)})`;
}
