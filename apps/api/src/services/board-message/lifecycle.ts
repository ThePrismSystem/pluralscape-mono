import { boardMessages } from "@pluralscape/db/pg";

import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toBoardMessageResult } from "./internal.js";

import type { BoardMessageResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { BoardMessageId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const BOARD_MESSAGE_LIFECYCLE: ArchivableEntityConfig<BoardMessageId> = {
  table: boardMessages,
  columns: boardMessages,
  entityName: "Board message",
  archiveEvent: "board-message.archived" as const,
  restoreEvent: "board-message.restored" as const,
  onArchive: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "board-message.archived", {
      boardMessageId: eid,
    }),
  onRestore: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "board-message.restored", {
      boardMessageId: eid,
    }),
};

export async function archiveBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, boardMessageId, auth, audit, BOARD_MESSAGE_LIFECYCLE);
}

export async function restoreBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<BoardMessageResult> {
  return restoreEntity(db, systemId, boardMessageId, auth, audit, BOARD_MESSAGE_LIFECYCLE, (row) =>
    toBoardMessageResult(row as typeof boardMessages.$inferSelect),
  );
}
