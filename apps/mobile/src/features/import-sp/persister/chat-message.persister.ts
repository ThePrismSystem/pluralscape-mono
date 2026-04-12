/**
 * Chat message persister.
 *
 * SP `chatMessages` → Pluralscape chat messages. The mapper has
 * resolved channel, sender, and replyTo FKs, so the payload is ready
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
  readonly encrypted: {
    readonly content: string;
    readonly senderId: string | null;
    readonly attachments: readonly unknown[];
    readonly mentions: readonly string[];
  };
  readonly channelId: string;
  readonly timestamp: number;
  readonly replyToId?: string | null;
}

function isChatMessagePayload(value: unknown): value is ChatMessagePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["content"] === "string" && typeof record["channelId"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isChatMessagePayload, "chat-message");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.message.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    channelId: narrowed.channelId,
    timestamp: narrowed.timestamp,
    replyToId: narrowed.replyToId ?? null,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isChatMessagePayload, "chat-message");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.message.update(ctx.systemId, existingId, {
    encryptedData: encrypted.encryptedData,
    version: encrypted.version,
    channelId: narrowed.channelId,
  });
  return { pluralscapeEntityId: result.id };
}

export const chatMessagePersister: EntityPersister = { create, update };
