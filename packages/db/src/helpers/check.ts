import { sql, type SQL } from "drizzle-orm";

import type { AnyColumn } from "drizzle-orm";

/** Generate a CHECK constraint SQL fragment from a column and an array of allowed values. */
export function enumCheck(column: AnyColumn, values: readonly string[]): SQL {
  const list = values.map((v) => `'${v}'`).join(", ");
  return sql`${column} IN (${sql.raw(list)})`;
}
