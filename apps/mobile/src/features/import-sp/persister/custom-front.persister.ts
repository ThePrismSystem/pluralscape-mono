/**
 * Custom front persister.
 *
 * SP `frontStatuses` → Pluralscape `custom_fronts`. A custom front is an
 * abstract cognitive state the user logs the same way as a member
 * (e.g. "Dissociated", "Blurry") — it has a name, description, colour,
 * and optional avatar URL.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

/**
 * Narrowed shape of `MappedCustomFront`. The avatar URL is carried as
 * plaintext in the payload; Phase C does not fan out avatar fetching for
 * custom fronts (members come first — see `member.persister.ts`).
 */
export interface CustomFrontPayload {
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly avatarUrl: string | null;
}

function isCustomFrontPayload(value: unknown): value is CustomFrontPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record["name"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isCustomFrontPayload, "custom-front");
  const encrypted = encryptForCreate(narrowed, ctx.masterKey);
  const result = await ctx.api.customFront.create(ctx.systemId, encrypted);
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isCustomFrontPayload, "custom-front");
  const encrypted = encryptForUpdate(narrowed, 1, ctx.masterKey);
  const result = await ctx.api.customFront.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const customFrontPersister: EntityPersister = { create, update };
