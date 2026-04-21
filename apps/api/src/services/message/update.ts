import { messages } from "@pluralscape/db/pg";
import { brandId, now } from "@pluralscape/types";
import { UpdateMessageBodySchema } from "@pluralscape/validation";
import { and, eq, sql } from "drizzle-orm";

import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { assertOccUpdated } from "../../lib/occ-update.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { messageIdConditions, toMessageResult } from "./internal.js";

import type { MessageResult, TimestampHint } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ChannelId, MessageId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function updateMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  messageId: MessageId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
  hint?: TimestampHint,
): Promise<MessageResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    UpdateMessageBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );
  const version = parsed.version;
  const ts = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    const updated = await tx
      .update(messages)
      .set({
        encryptedData: blob,
        editedAt: ts,
        updatedAt: ts,
        version: sql`${messages.version} + 1`,
      })
      .where(
        and(
          ...messageIdConditions(messageId, systemId, hint),
          eq(messages.version, version),
          eq(messages.archived, false),
        ),
      )
      .returning();

    const row = await assertOccUpdated(
      updated,
      async () => {
        const [existing] = await tx
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(...messageIdConditions(messageId, systemId, hint), eq(messages.archived, false)),
          )
          .limit(1);
        return existing;
      },
      "Message",
    );

    await audit(tx, {
      eventType: "message.updated",
      actor: { kind: "account", id: auth.accountId },
      detail: "Message updated",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "message.updated", {
      messageId: brandId<MessageId>(row.id),
      channelId: brandId<ChannelId>(row.channelId),
    });

    return toMessageResult(row);
  });
}
