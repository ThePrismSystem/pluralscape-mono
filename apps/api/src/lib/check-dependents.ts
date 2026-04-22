import { count } from "drizzle-orm";

import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface DependentCheck<T extends string = string> {
  readonly table: PgTable;
  /**
   * Drizzle `and()` / `or()` return `SQL | undefined`. We accept that shape
   * directly so callers can pass `and(...)` without non-null assertions; an
   * `undefined` predicate means "no filter" and will count every row in the
   * table (matches `.where(undefined)` semantics in drizzle).
   */
  readonly predicate: SQL | undefined;
  readonly typeName: T;
}

export interface DependentResult<T extends string = string> {
  readonly type: T;
  readonly count: number;
}

export interface CheckDependentsResult<T extends string = string> {
  readonly dependents: DependentResult<T>[];
}

/**
 * Run parallel count queries against FK dependent tables and return non-zero
 * counts keyed by the caller-supplied type name.
 *
 * The `const T` type parameter captures the caller's `typeName` string
 * literals, so the returned `dependents[].type` is a narrow union rather than
 * `string`. This restores the compile-time safety the per-service union types
 * used to provide before this helper was extracted — callers and downstream
 * `switch`/`.find()` code get literal-type narrowing automatically.
 *
 * Callers decide the failure semantics: throw `ApiHttpError(HTTP_CONFLICT,
 * "HAS_DEPENDENTS", ...)` with the returned `dependents` array as the error
 * details, or use the counts in any other way (e.g. force-delete with
 * cascade). The helper itself is predicate-agnostic.
 */
export async function checkDependents<const T extends string>(
  tx: PostgresJsDatabase,
  checks: readonly DependentCheck<T>[],
): Promise<CheckDependentsResult<T>> {
  if (checks.length === 0) {
    return { dependents: [] };
  }

  const rows = await Promise.all(
    checks.map((check) => tx.select({ count: count() }).from(check.table).where(check.predicate)),
  );

  const dependents: DependentResult<T>[] = [];
  checks.forEach((check, i) => {
    const row = rows[i]?.[0];
    if (!row) {
      throw new Error("Unexpected: count query returned no rows");
    }
    if (row.count > 0) {
      dependents.push({ type: check.typeName, count: row.count });
    }
  });

  return { dependents };
}
