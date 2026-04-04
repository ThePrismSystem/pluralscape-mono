import {
  assertArrayField,
  assertObjectBlob,
  assertStringField,
  decodeAndDecryptT1,
  encryptInput,
  encryptUpdate,
} from "./decode-blob.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type {
  ArchivedChatMessage,
  BlobId,
  ChatMessage,
  MemberId,
  UnixMillis,
} from "@pluralscape/types";

// ── Wire types (derived from domain types) ──────────────────────────

/** Wire shape returned by `chatMessage.get` — derived from the `ChatMessage` domain type. */
export type MessageRaw = Omit<ChatMessage, keyof MessageEncryptedFields | "archived"> & {
  readonly encryptedData: string;
  readonly archived: boolean;
  readonly archivedAt: UnixMillis | null;
};

/** Shape returned by `chatMessage.list`. */
export interface MessagePage {
  readonly data: readonly MessageRaw[];
  readonly nextCursor: string | null;
}

// ── Encrypted payload types ───────────────────────────────────────────

/**
 * The plaintext fields encrypted inside a chat message blob.
 * Pass this to `encryptMessageInput` when creating or updating a message.
 */
export interface MessageEncryptedFields {
  readonly content: string;
  readonly attachments: readonly BlobId[];
  readonly mentions: readonly MemberId[];
  readonly senderId: MemberId;
}

// ── Validators ────────────────────────────────────────────────────────

function assertMessageEncryptedFields(raw: unknown): asserts raw is MessageEncryptedFields {
  const obj = assertObjectBlob(raw, "message");
  assertStringField(obj, "message", "content");
  assertStringField(obj, "message", "senderId");
  assertArrayField(obj, "message", "attachments");
  assertArrayField(obj, "message", "mentions");
}

// ── Message transforms ────────────────────────────────────────────────

/**
 * Decrypt a single chat message API result into a `ChatMessage`.
 *
 * The encrypted blob contains: `content`, `attachments`, `mentions`, `senderId`.
 * All other fields pass through from the wire payload.
 */
export function decryptMessage(
  raw: MessageRaw,
  masterKey: KdfMasterKey,
): ChatMessage | ArchivedChatMessage {
  const plaintext = decodeAndDecryptT1(raw.encryptedData, masterKey);
  assertMessageEncryptedFields(plaintext);

  const base = {
    id: raw.id,
    channelId: raw.channelId,
    systemId: raw.systemId,
    senderId: plaintext.senderId,
    content: plaintext.content,
    attachments: plaintext.attachments,
    mentions: plaintext.mentions,
    replyToId: raw.replyToId,
    timestamp: raw.timestamp,
    editedAt: raw.editedAt,
    version: raw.version,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (raw.archived) {
    if (raw.archivedAt === null) throw new Error("Archived message missing archivedAt");
    return { ...base, archived: true as const, archivedAt: raw.archivedAt };
  }
  return { ...base, archived: false as const };
}

/**
 * Decrypt a paginated chat message list result.
 */
export function decryptMessagePage(
  raw: MessagePage,
  masterKey: KdfMasterKey,
): { data: (ChatMessage | ArchivedChatMessage)[]; nextCursor: string | null } {
  return {
    data: raw.data.map((item) => decryptMessage(item, masterKey)),
    nextCursor: raw.nextCursor,
  };
}

/**
 * Encrypt chat message plaintext fields for create payloads.
 *
 * Returns `{ encryptedData: string }` — pass the spread of this into the
 * `CreateMessageBodySchema`.
 */
export function encryptMessageInput(
  data: MessageEncryptedFields,
  masterKey: KdfMasterKey,
): { encryptedData: string } {
  return encryptInput(data, masterKey);
}

/**
 * Encrypt chat message plaintext fields for update payloads.
 *
 * Returns `{ encryptedData: string; version: number }` — pass the spread of this
 * into the `UpdateMessageBodySchema`.
 */
export function encryptMessageUpdate(
  data: MessageEncryptedFields,
  version: number,
  masterKey: KdfMasterKey,
): { encryptedData: string; version: number } {
  return encryptUpdate(data, version, masterKey);
}
