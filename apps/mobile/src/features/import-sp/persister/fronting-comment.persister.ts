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
  readonly encrypted: {
    readonly content: string;
  };
  readonly frontingSessionId: string;
  readonly createdAt: number;
  readonly memberId?: string | null;
  readonly customFrontId?: string | null;
  readonly structureEntityId?: string | null;
}

function isFrontingCommentPayload(value: unknown): value is FrontingCommentPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return (
    typeof encrypted["content"] === "string" && typeof record["frontingSessionId"] === "string"
  );
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isFrontingCommentPayload, "fronting-comment");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.frontingComment.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    sessionId: narrowed.frontingSessionId,
    memberId: narrowed.memberId ?? null,
    customFrontId: narrowed.customFrontId ?? null,
    structureEntityId: narrowed.structureEntityId ?? null,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isFrontingCommentPayload, "fronting-comment");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.frontingComment.update(ctx.systemId, existingId, {
    encryptedData: encrypted.encryptedData,
    version: encrypted.version,
    sessionId: narrowed.frontingSessionId,
  });
  return { pluralscapeEntityId: result.id };
}

export const frontingCommentPersister: EntityPersister = { create, update };
