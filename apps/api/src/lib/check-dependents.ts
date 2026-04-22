import { count } from "drizzle-orm";

import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface DependentCheck {
  readonly table: PgTable;
  /**
   * Drizzle `and()` / `or()` return `SQL | undefined`. We accept that shape
   * directly so callers can pass `and(...)` without non-null assertions; an
   * `undefined` predicate means "no filter" and will count every row in the
   * table (matches `.where(undefined)` semantics in drizzle).
   */
  readonly predicate: SQL | undefined;
  readonly typeName: string;
}

export interface DependentResult {
  readonly type: string;
  readonly count: number;
}

export interface CheckDependentsResult {
  readonly dependents: DependentResult[];
}

/**
 * Run parallel count queries against FK dependent tables and return non-zero
 * counts keyed by the caller-supplied type name.
 *
 * Callers decide the failure semantics: throw `ApiHttpError(HTTP_CONFLICT,
 * "HAS_DEPENDENTS", ...)` with the returned `dependents` array as the error
 * details, or use the counts in any other way (e.g. force-delete with
 * cascade). The helper itself is predicate-agnostic.
 */
export async function checkDependents(
  tx: PostgresJsDatabase,
  checks: readonly DependentCheck[],
): Promise<CheckDependentsResult> {
  if (checks.length === 0) {
    return { dependents: [] };
  }

  const rows = await Promise.all(
    checks.map((check) => tx.select({ count: count() }).from(check.table).where(check.predicate)),
  );

  const dependents: DependentResult[] = [];
  rows.forEach((result, i) => {
    const [row] = result;
    const check = checks[i];
    if (!row || !check) {
      throw new Error("Unexpected: count query returned no rows");
    }
    if (row.count > 0) {
      dependents.push({ type: check.typeName, count: row.count });
    }
  });

  return { dependents };
}
