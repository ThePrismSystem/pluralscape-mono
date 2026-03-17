import { pgCleanupAuditLog } from "@pluralscape/db";
import { AUDIT_LOG_RETENTION_DAYS } from "@pluralscape/queue";

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
  return async () => {
    await pgCleanupAuditLog(db, { olderThanDays: AUDIT_LOG_RETENTION_DAYS });
  };
}
