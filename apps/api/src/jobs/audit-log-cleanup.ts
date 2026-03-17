import { AUDIT_LOG_RETENTION_DAYS, pgCleanupAuditLog } from "@pluralscape/db";

import type { JobHandler } from "@pluralscape/queue";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Creates a job handler for the `audit-log-cleanup` job type.
 *
 * Deletes audit log entries older than the configured retention period
 * to limit long-term PII exposure.
 */
export function createAuditLogCleanupHandler(
  db: PostgresJsDatabase,
): JobHandler<"audit-log-cleanup"> {
  return async (_job, ctx) => {
    if (ctx.signal.aborted) return;
    await pgCleanupAuditLog(db, { olderThanDays: AUDIT_LOG_RETENTION_DAYS });
  };
}
