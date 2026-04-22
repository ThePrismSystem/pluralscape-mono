import { channels, messages } from "@pluralscape/db/pg";
import { brandId, ID_PREFIXES, createId, now } from "@pluralscape/types";
import { CreateMessageBodySchema } from "@pluralscape/validation";
import { and, eq } from "drizzle-orm";

import { HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { parseAndValidateBlob } from "../../lib/encrypted-blob.js";
import { withTenantTransaction } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { MAX_ENCRYPTED_DATA_BYTES } from "../../service.constants.js";
import { dispatchWebhookEvent } from "../webhook-dispatcher.js";

import { toMessageResult } from "./internal.js";

import type { MessageResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { ChannelId, MessageId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export async function createMessage(
  db: PostgresJsDatabase,
  systemId: SystemId,
  channelId: ChannelId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
): Promise<MessageResult> {
  assertSystemOwnership(systemId, auth);

  const { parsed, blob } = parseAndValidateBlob(
    params,
    CreateMessageBodySchema,
    MAX_ENCRYPTED_DATA_BYTES,
  );

  const messageId = createId(ID_PREFIXES.message);
  const ts = now();

  return withTenantTransaction(db, tenantCtx(systemId, auth), async (tx) => {
    // Verify channel exists and is a channel (not a category)
    const [channel] = await tx
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.id, channelId),
          eq(channels.systemId, systemId),
          eq(channels.archived, false),
          eq(channels.type, "channel"),
        ),
      )
      .limit(1);

    if (!channel) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Channel not found");
    }

    const [row] = await tx
      .insert(messages)
      .values({
        id: messageId,
        channelId,
        systemId,
        replyToId: parsed.replyToId ?? null,
        timestamp: parsed.timestamp,
        encryptedData: blob,
        createdAt: ts,
        updatedAt: ts,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create message — INSERT returned no rows");
    }

    await audit(tx, {
      eventType: "message.created",
      actor: { kind: "account", id: auth.accountId },
      detail: "Message created",
      systemId,
    });
    await dispatchWebhookEvent(tx, systemId, "message.created", {
      messageId: brandId<MessageId>(row.id),
      channelId: channelId,
    });

    return toMessageResult(row);
  });
}
