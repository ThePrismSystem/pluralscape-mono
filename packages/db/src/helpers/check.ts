import { sql, type SQL } from "drizzle-orm";

import type { AnyColumn } from "drizzle-orm";

const SAFE_ENUM_VALUE = /^[\w.:-]+$/;

/**
 * Generate a CHECK constraint SQL fragment from a column and an array of allowed values.
 *
 * WARNING: Values are interpolated via `sql.raw()` — they must be trusted compile-time
 * constants (e.g. const arrays derived from type unions). A runtime regex guard is applied
 * as defense-in-depth, but never pass user input here.
 */
export function enumCheck(column: AnyColumn, values: readonly string[]): SQL {
  for (const v of values) {
    if (!SAFE_ENUM_VALUE.test(v)) {
      throw new Error(`enumCheck: unsafe value "${v}" — must match ${String(SAFE_ENUM_VALUE)}`);
    }
  }
  const list = values.map((v) => `'${v}'`).join(", ");
  return sql`${column} IN (${sql.raw(list)})`;
}
