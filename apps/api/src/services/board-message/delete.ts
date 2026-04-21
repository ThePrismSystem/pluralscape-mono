import { boardMessages } from "@pluralscape/db/pg";

import { deleteEntity } from "../../lib/entity-lifecycle.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { DeletableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { BoardMessageId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const BOARD_MESSAGE_DELETE: DeletableEntityConfig<BoardMessageId> = {
  table: boardMessages,
  columns: boardMessages,
  entityName: "Board message",
  deleteEvent: "board-message.deleted",
  onDelete: (tx, sId, eid) =>
    dispatchWebhookEvent(tx, sId, "board-message.deleted", { boardMessageId: eid }),
};

export async function deleteBoardMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  boardMessageId: BoardMessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await deleteEntity(db, systemId, boardMessageId, auth, audit, BOARD_MESSAGE_DELETE);
}
