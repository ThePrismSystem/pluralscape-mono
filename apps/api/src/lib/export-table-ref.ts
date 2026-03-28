/**
 * Shared export table infrastructure for friend-export and bucket-export.
 *
 * Provides the ExportTableRef interface, exportRef() factory, and keysetAfter()
 * cursor pagination helper used by both export registries.
 */
import { and, eq, gt, or } from "drizzle-orm";

import type { DecodedCompositeCursor } from "./pagination.js";
import type { SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/**
 * Decomposed table reference separating PgTable (for `.from()`) from
 * individual column references (for `.select()`, `.where()`, etc.).
 *
 * This separation is needed because drizzle's `.from()` requires a
 * concrete PgTable type, while column references need PgColumn types
 * for query builder methods.
 */
export interface ExportTableRef {
  readonly table: PgTable;
  readonly id: PgColumn;
  readonly systemId: PgColumn;
  readonly encryptedData: PgColumn;
  readonly updatedAt: PgColumn;
  readonly archived?: PgColumn;
}

/** Extract an ExportTableRef from a drizzle table with the required columns. */
export function exportRef(
  t: PgTable & {
    id: PgColumn;
    systemId: PgColumn;
    encryptedData: PgColumn;
    updatedAt: PgColumn;
    archived?: PgColumn;
  },
): ExportTableRef {
  return {
    table: t,
    id: t.id,
    systemId: t.systemId,
    encryptedData: t.encryptedData,
    updatedAt: t.updatedAt,
    archived: t.archived,
  };
}

/**
 * Keyset "after" condition for cursor pagination.
 *
 * Produces: (sortCol > cursor.sortValue) OR (sortCol = cursor.sortValue AND idCol > cursor.id)
 * The `or()` call with two defined arguments always returns SQL, but we guard at runtime.
 */
export function keysetAfter(
  sortCol: PgColumn,
  idCol: PgColumn,
  cursor: DecodedCompositeCursor,
): SQL {
  const result = or(
    gt(sortCol, cursor.sortValue),
    and(eq(sortCol, cursor.sortValue), gt(idCol, cursor.id)),
  );
  if (!result) throw new Error("keysetAfter: or() returned undefined");
  return result;
}

/**
 * Maximum number of concurrent manifest COUNT queries per batch.
 *
 * Limits connection pool contention when building manifests across all
 * 21 entity types. Queries run in sequential batches of this size.
 */
const MANIFEST_BATCH_SIZE = 5;

/**
 * Execute async tasks in sequential batches to limit concurrency.
 *
 * Runs up to MANIFEST_BATCH_SIZE tasks in parallel per batch, waiting
 * for each batch to complete before starting the next. This prevents
 * 21 simultaneous COUNT queries from saturating the connection pool.
 */
export async function batchedManifestQueries<T>(tasks: readonly (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += MANIFEST_BATCH_SIZE) {
    const batch = tasks.slice(i, i + MANIFEST_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((task) => task()));
    results.push(...batchResults);
  }
  return results;
}
