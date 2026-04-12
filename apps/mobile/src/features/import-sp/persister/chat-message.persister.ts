/**
 * Chat message persister.
 *
 * SP `chatMessages` → Pluralscape chat messages. The mapper has
 * resolved channel, writer, and replyTo FKs, so the payload is ready
 * to encrypt and push through `message.create` / `message.update`.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface ChatMessagePayload {
  readonly channelId: string;
  readonly writerMemberId: string;
  readonly body: string;
  readonly createdAt: number;
  readonly replyToChatMessageId: string | null;
}

function isChatMessagePayload(value: unknown): value is ChatMessagePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["channelId"] === "string" &&
    typeof record["writerMemberId"] === "string" &&
    typeof record["body"] === "string"
  );
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isChatMessagePayload, "chat-message");
  const encrypted = encryptForCreate(
    {
      body: narrowed.body,
      writerMemberId: narrowed.writerMemberId,
      createdAt: narrowed.createdAt,
      replyToChatMessageId: narrowed.replyToChatMessageId,
    },
    ctx.masterKey,
  );
  const result = await ctx.api.message.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    channelId: narrowed.channelId,
    timestamp: narrowed.createdAt,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isChatMessagePayload, "chat-message");
  const encrypted = encryptForUpdate(
    {
      body: narrowed.body,
      writerMemberId: narrowed.writerMemberId,
      createdAt: narrowed.createdAt,
      replyToChatMessageId: narrowed.replyToChatMessageId,
    },
    1,
    ctx.masterKey,
  );
  const result = await ctx.api.message.update(ctx.systemId, existingId, {
    ...encrypted,
    channelId: narrowed.channelId,
  });
  return { pluralscapeEntityId: result.id };
}

export const chatMessagePersister: EntityPersister = { create, update };
