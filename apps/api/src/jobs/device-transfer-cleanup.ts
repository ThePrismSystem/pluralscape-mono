import { pgCleanupDeviceTransfers } from "@pluralscape/db";

import type { JobHandler } from "@pluralscape/queue";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Creates a job handler for the `device-transfer-cleanup` job type.
 *
 * Expires pending device transfer requests whose expiresAt has passed,
 * preventing stale transfer sessions from lingering in the database.
 */
export function createDeviceTransferCleanupHandler(
  db: PostgresJsDatabase,
): JobHandler<"device-transfer-cleanup"> {
  return async (_job, ctx) => {
    if (ctx.signal.aborted) return;
    await pgCleanupDeviceTransfers(db);
  };
}
