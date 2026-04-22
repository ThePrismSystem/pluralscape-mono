import { messages } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { archiveEntity, restoreEntity } from "../../lib/entity-lifecycle.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toMessageResult } from "./internal.js";

import type { MessageResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ArchivableEntityConfig } from "../../lib/entity-lifecycle.js";
import type { ChannelId, MessageId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const MESSAGE_LIFECYCLE: ArchivableEntityConfig<MessageId> = {
  table: messages,
  columns: messages,
  entityName: "Message",
  archiveEvent: "message.archived" as const,
  restoreEvent: "message.restored" as const,
  onArchive: async (tx, sId, eid) => {
    const [msg] = await tx
      .select({ channelId: messages.channelId })
      .from(messages)
      .where(eq(messages.id, eid))
      .limit(1);
    if (msg) {
      await dispatchWebhookEvent(tx, sId, "message.archived", {
        messageId: eid,
        channelId: brandId<ChannelId>(msg.channelId),
      });
    }
  },
  onRestore: async (tx, sId, eid) => {
    const [msg] = await tx
      .select({ channelId: messages.channelId })
      .from(messages)
      .where(eq(messages.id, eid))
      .limit(1);
    if (msg) {
      await dispatchWebhookEvent(tx, sId, "message.restored", {
        messageId: eid,
        channelId: brandId<ChannelId>(msg.channelId),
      });
    }
  },
};

export async function archiveMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<void> {
  await archiveEntity(db, systemId, messageId, auth, audit, MESSAGE_LIFECYCLE);
}

export async function restoreMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MessageResult> {
  return restoreEntity(db, systemId, messageId, auth, audit, MESSAGE_LIFECYCLE, (row) =>
    toMessageResult(row as typeof messages.$inferSelect),
  );
}
