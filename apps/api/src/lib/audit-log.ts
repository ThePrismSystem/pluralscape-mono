import { auditLog } from "@pluralscape/db/pg";
import { createId, now } from "@pluralscape/types";

import type { DbAuditActor } from "@pluralscape/db";
import type { AuditEventType } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Parameters for writing an audit log entry. */
export interface WriteAuditLogParams {
  readonly accountId: string | null;
  readonly systemId: string | null;
  readonly eventType: AuditEventType;
  readonly actor: DbAuditActor;
  readonly detail?: string | null;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

/**
 * Insert an audit log entry.
 * Accepts a Drizzle PG database client for transaction support.
 */
export async function writeAuditLog(
  db: PostgresJsDatabase,
  params: WriteAuditLogParams,
): Promise<void> {
  const timestamp = now();
  await db.insert(auditLog).values({
    id: createId("al_"),
    accountId: params.accountId,
    systemId: params.systemId,
    eventType: params.eventType,
    timestamp,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    actor: params.actor,
    detail: params.detail ?? null,
  });
}
