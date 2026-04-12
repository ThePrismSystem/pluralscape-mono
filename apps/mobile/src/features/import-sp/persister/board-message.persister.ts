/**
 * Board message persister.
 *
 * SP `boardMessages` → Pluralscape board messages. The mapper has
 * already resolved the sender member FK. The persister encrypts and
 * pushes through `boardMessage.create` / `boardMessage.update`.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface BoardMessagePayload {
  readonly encrypted: {
    readonly content: string;
    readonly senderId: string | null;
  };
  readonly sortOrder: number;
  readonly pinned?: boolean;
  readonly createdAt: number;
}

function isBoardMessagePayload(value: unknown): value is BoardMessagePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["content"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isBoardMessagePayload, "board-message");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.boardMessage.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    sortOrder: narrowed.sortOrder,
    pinned: narrowed.pinned ?? false,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isBoardMessagePayload, "board-message");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.boardMessage.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const boardMessagePersister: EntityPersister = { create, update };
