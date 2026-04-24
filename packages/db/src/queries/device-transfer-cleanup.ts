import { toUnixMillis } from "@pluralscape/types";
import { and, eq, lte, sql } from "drizzle-orm";

import { deviceTransferRequests as pgDeviceTransferRequests } from "../schema/pg/auth.js";
import { deviceTransferRequests as sqliteDeviceTransferRequests } from "../schema/sqlite/auth.js";

import { extractDeletedCount } from "./types.js";

import type { CleanupResult } from "./types.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Expire pending device transfer requests whose expiresAt has passed.
 *
 * Uses a CTE to atomically update and count affected rows without
 * materializing them into JS memory. The `sql.raw` usage for the SET
 * clause is necessary because Drizzle's CTE support does not cover
 * UPDATE...SET natively.
 */
export async function pgCleanupDeviceTransfers<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: PostgresJsDatabase<TSchema> | PgliteDatabase<TSchema>): Promise<CleanupResult> {
  const result = await db.execute<{ deleted_count: string }>(
    sql`WITH expired AS (
      UPDATE ${pgDeviceTransferRequests}
      SET ${sql.raw(`"status" = 'expired'`)}
      WHERE ${pgDeviceTransferRequests.status} = 'pending'
        AND ${pgDeviceTransferRequests.expiresAt} <= ${sql`now()`}
      RETURNING 1
    )
    SELECT count(*) AS deleted_count FROM expired`,
  );

  return extractDeletedCount(result);
}

/**
 * Expire pending device transfer requests whose expiresAt has passed (SQLite).
 *
 * Follows the same pattern as sqliteCleanupAuditLog — uses Drizzle's
 * type-safe update builder rather than raw SQL.
 */
export function sqliteCleanupDeviceTransfers<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: BetterSQLite3Database<TSchema>): CleanupResult {
  const cutoffMs = toUnixMillis(Date.now());

  const result = db
    .update(sqliteDeviceTransferRequests)
    .set({ status: "expired" })
    .where(
      and(
        eq(sqliteDeviceTransferRequests.status, "pending"),
        lte(sqliteDeviceTransferRequests.expiresAt, cutoffMs),
      ),
    )
    .run();

  return { deletedCount: result.changes };
}
