import { sql } from "drizzle-orm";

import { deviceTransferRequests as pgDeviceTransferRequests } from "../schema/pg/auth.js";

import { extractDeletedCount } from "./types.js";

import type { CleanupResult } from "./types.js";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Expire pending device transfer requests whose expiresAt has passed.
 *
 * Uses a CTE to atomically update and count affected rows without
 * materializing them into JS memory.
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
