import { auditLog } from "@pluralscape/db/pg";
import { createId, now } from "@pluralscape/types";

import { AUDIT_LOG_IP_MAX_LENGTH, AUDIT_LOG_UA_MAX_LENGTH } from "./audit-log.constants.js";

import type { DbAuditActor } from "@pluralscape/db";
import type { AccountId, AuditEventType, SystemId } from "@pluralscape/types";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** Parameters for writing an audit log entry. */
export interface WriteAuditLogParams {
  readonly accountId: AccountId | null;
  readonly systemId: SystemId | null;
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
  db: PgDatabase<PgQueryResultHKT>,
  params: WriteAuditLogParams,
): Promise<void> {
  const timestamp = now();
  await db.insert(auditLog).values({
    id: createId("al_"),
    accountId: params.accountId,
    systemId: params.systemId,
    eventType: params.eventType,
    timestamp,
    ipAddress: (params.ipAddress ?? null)?.slice(0, AUDIT_LOG_IP_MAX_LENGTH) ?? null,
    userAgent: (params.userAgent ?? null)?.slice(0, AUDIT_LOG_UA_MAX_LENGTH) ?? null,
    actor: params.actor,
    detail: params.detail ?? null,
  });
}
