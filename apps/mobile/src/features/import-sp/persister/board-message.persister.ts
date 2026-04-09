/**
 * Board message persister.
 *
 * SP `boardMessages` → Pluralscape board messages. The mapper has
 * already resolved the author member FK. The persister encrypts and
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
  readonly title: string;
  readonly body: string;
  readonly authorMemberId: string;
  readonly createdAt: number;
}

function isBoardMessagePayload(value: unknown): value is BoardMessagePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["title"] === "string" &&
    typeof record["body"] === "string" &&
    typeof record["authorMemberId"] === "string"
  );
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isBoardMessagePayload, "board-message");
  const encrypted = encryptForCreate(narrowed, ctx.masterKey);
  const result = await ctx.api.boardMessage.create(ctx.systemId, encrypted);
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isBoardMessagePayload, "board-message");
  const encrypted = encryptForUpdate(narrowed, 1, ctx.masterKey);
  const result = await ctx.api.boardMessage.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const boardMessagePersister: EntityPersister = { create, update };
