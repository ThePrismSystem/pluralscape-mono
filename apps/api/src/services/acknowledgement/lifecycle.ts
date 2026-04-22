import { acknowledgements } from "@pluralscape/db/pg";

import { archiveEntity, deleteEntity, restoreEntity } from "../../lib/entity-lifecycle.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toAcknowledgementResult, type AcknowledgementResult } from "./internal.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ArchivableEntityConfig, DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { AcknowledgementId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const ACK_DELETE: DeletableEntityConfig<AcknowledgementId> = {
  table: acknowledgements,
  columns: acknowledgements,
  entityName: "Acknowledgement",
  deleteEvent: "acknowledgement.deleted",
  onDelete: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "acknowledgement.deleted", { acknowledgementId: eid }),
};

const ACK_LIFECYCLE: ArchivableEntityConfig<AcknowledgementId> = {
  table: acknowledgements,
  columns: acknowledgements,
  entityName: "Acknowledgement",
  archiveEvent: "acknowledgement.archived" as const,
  restoreEvent: "acknowledgement.restored" as const,
  onArchive: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "acknowledgement.archived", {
      acknowledgementId: eid,
    }),
  onRestore: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "acknowledgement.restored", {
      acknowledgementId: eid,
    }),
};

export async function deleteAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await deleteEntity(db, systemId, ackId, auth, audit, ACK_DELETE);
}

export async function archiveAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, ackId, auth, audit, ACK_LIFECYCLE);
}

export async function restoreAcknowledgement(
  db: PostgresJsDatabase,
  systemId: SystemId,
  ackId: AcknowledgementId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<AcknowledgementResult> {
  return restoreEntity(db, systemId, ackId, auth, audit, ACK_LIFECYCLE, (row) =>
    toAcknowledgementResult(row as typeof acknowledgements.$inferSelect),
  );
}
