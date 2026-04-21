import { messages } from "@pluralscape/db/pg";
import { brandId, toUnixMillis, toUnixMillisOrNull } from "@pluralscape/types";
import { eq } from "drizzle-orm";

import { encryptedBlobToBase64 } from "../../lib/encrypted-blob.js";

import type {
  ChannelId,
  MessageId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

export interface MessageResult {
  readonly id: MessageId;
  readonly channelId: ChannelId;
  readonly systemId: SystemId;
  readonly replyToId: MessageId | null;
  readonly timestamp: UnixMillis;
  readonly editedAt: UnixMillis | null;
  readonly encryptedData: string;
  readonly version: number;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
  readonly createdAt: UnixMillis;
  readonly updatedAt: UnixMillis;
}

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
) {
  const conditions = [eq(messages.id, messageId), eq(messages.systemId, systemId)];
  if (hint?.timestamp !== undefined) {
    conditions.push(eq(messages.timestamp, hint.timestamp));
  }
  return conditions;
}
