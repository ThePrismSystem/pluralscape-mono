import { messages } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { messageIdConditions } from "./internal.js";

import type { TimestampHint } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ChannelId, MessageId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function deleteMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  auth: AuthContext,
  audit: AuditWriter,
  hint?: TimestampHint,
): Promise<void> {
  assertSystemOwnership(systemId, auth);

  await withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const [existing] = await tx
      .select({ id: messages.id, channelId: messages.channelId })
      .from(messages)
      .where(and(...messageIdConditions(messageId, systemId, hint), eq(messages.archived, false)))
      .limit(1);

    if (!existing) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Message not found");
    }

    await audit(tx, {
      eventType: "message.deleted",
      actor: { kind: "account", id: auth.accountId },
      detail: "Message deleted",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "message.deleted", {
      messageId: brandId<MessageId>(existing.id),
      channelId: brandId<ChannelId>(existing.channelId),
    });

    await tx
      .delete(messages)
      .where(and(...messageIdConditions(messageId, systemId, hint), eq(messages.archived, false)));
  });
}
