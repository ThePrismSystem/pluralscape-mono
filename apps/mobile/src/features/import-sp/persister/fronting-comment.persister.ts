/**
 * Fronting comment persister.
 *
 * SP `comments` → Pluralscape fronting-session comments. The mapper has
 * already resolved the session FK, so the payload is ready to encrypt
 * and push through `frontingComment.create` / `frontingComment.update`.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface FrontingCommentPayload {
  readonly frontingSessionId: string;
  readonly body: string;
  readonly createdAt: number;
}

function isFrontingCommentPayload(value: unknown): value is FrontingCommentPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record["frontingSessionId"] === "string" && typeof record["body"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isFrontingCommentPayload, "fronting-comment");
  const encrypted = encryptForCreate(narrowed, ctx.masterKey);
  const result = await ctx.api.frontingComment.create(ctx.systemId, {
    ...encrypted,
    sessionId: narrowed.frontingSessionId,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isFrontingCommentPayload, "fronting-comment");
  const encrypted = encryptForUpdate(narrowed, 1, ctx.masterKey);
  const result = await ctx.api.frontingComment.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const frontingCommentPersister: EntityPersister = { create, update };
