/**
 * Fronting session persister.
 *
 * SP `frontHistory` → Pluralscape fronting sessions. The mapper already
 * resolves the fronting actor (member or custom-front) via the
 * IdTranslationTable, so the payload hands us resolved Pluralscape IDs
 * directly. The persister encrypts the session payload and issues
 * `frontingSession.create` / `frontingSession.update`.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface FrontingSessionPayload {
  readonly encrypted: {
    readonly comment: string | null;
    readonly positionality: string | null;
    readonly outtrigger: string | null;
    readonly outtriggerSentiment: string | null;
  };
  readonly startTime: number;
  readonly endTime: number | null;
  readonly memberId?: string | null;
  readonly customFrontId?: string | null;
  readonly structureEntityId?: string | null;
}

function isFrontingSessionPayload(value: unknown): value is FrontingSessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  return typeof record["startTime"] === "number";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isFrontingSessionPayload, "fronting-session");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.frontingSession.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    startTime: narrowed.startTime,
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
  const narrowed = assertPayloadShape(payload, isFrontingSessionPayload, "fronting-session");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.frontingSession.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const frontingSessionPersister: EntityPersister = { create, update };
