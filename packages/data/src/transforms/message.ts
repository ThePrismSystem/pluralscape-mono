import { brandId, toUnixMillis } from "@pluralscape/types";
import { ChatMessageEncryptedInputSchema } from "@pluralscape/validation";

import { decodeAndDecryptT1, encryptInput, encryptUpdate } from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ArchivedChatMessage,
  ChannelId,
  ChatMessage,
  ChatMessageEncryptedInput,
  MessageId,
  ChatMessageWire,
  SystemId,
} from "@pluralscape/types";

/** Shape returned by `chatMessage.list`. */
export interface MessagePage {
  readonly data: readonly ChatMessageWire[];
  readonly nextCursor: string | null;
}

export function decryptMessage(
  raw: ChatMessageWire,
  masterKey: KdfMasterKey,
): ChatMessage | ArchivedChatMessage {
  const decrypted = decodeAndDecryptT1(raw.encryptedData, masterKey);
  const validated = ChatMessageEncryptedInputSchema.parse(decrypted);

  const base = {
    id: brandId<MessageId>(raw.id),
    channelId: brandId<ChannelId>(raw.channelId),
    systemId: brandId<SystemId>(raw.systemId),
    senderId: validated.senderId,
    content: validated.content,
    attachments: validated.attachments,
    mentions: validated.mentions,
    replyToId: raw.replyToId === null ? null : brandId<MessageId>(raw.replyToId),
    timestamp: toUnixMillis(raw.timestamp),
    editedAt: raw.editedAt === null ? null : toUnixMillis(raw.editedAt),
    version: raw.version,
    createdAt: toUnixMillis(raw.createdAt),
    updatedAt: toUnixMillis(raw.updatedAt),
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived message missing archivedAt");
    return { ...base, archived: true as const, archivedAt: toUnixMillis(raw.archivedAt) };
  }
  return { ...base, archived: false as const };
}

export function decryptMessagePage(
  raw: MessagePage,
  masterKey: KdfMasterKey,
): { data: (ChatMessage | ArchivedChatMessage)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptMessage(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

export function encryptMessageInput(
  data: ChatMessageEncryptedInput,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

export function encryptMessageUpdate(
  data: ChatMessageEncryptedInput,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
