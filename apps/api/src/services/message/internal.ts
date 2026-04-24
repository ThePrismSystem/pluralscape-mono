import { messages } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { eq, type SQL } from "drizzle-orm";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  ChannelId,
  ChatMessageServerMetadata,
  EncryptedWire,
  MessageId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export type MessageResult = EncryptedWire<ChatMessageServerMetadata>;

export interface TimestampHint {
  readonly timestamp?: UnixMillis;
}

export function toMessageResult(row: typeof messages.$inferSelect): MessageResult {
  return {
    id: brandId<MessageId>(row.id),
    channelId: brandId<ChannelId>(row.channelId),
    systemId: brandId<SystemId>(row.systemId),
    replyToId: row.replyToId ? brandId<MessageId>(row.replyToId) : null,
    timestamp: toUnixMillis(row.timestamp),
    editedAt: toUnixMillisOrNull(row.editedAt),
    encryptedData: encryptedBlobToBase64(row.encryptedData),
    version: row.version,
    archived: row.archived,
    archivedAt: toUnixMillisOrNull(row.archivedAt),
    createdAt: toUnixMillis(row.createdAt),
    updatedAt: toUnixMillis(row.updatedAt),
  };
}

/** Build conditions for finding a message by id+systemId, optionally with timestamp for partition pruning. */
export function messageIdConditions(
  messageId: MessageId,
  systemId: SystemId,
  hint?: TimestampHint,
): SQL[] {
  const conditions = [eq(messages.id, messageId), eq(messages.systemId, systemId)];
  if (hint?.timestamp !== undefined) {
    conditions.push(eq(messages.timestamp, hint.timestamp));
  }
  return conditions;
}
