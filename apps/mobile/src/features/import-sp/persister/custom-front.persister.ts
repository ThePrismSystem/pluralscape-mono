/**
 * Custom front persister.
 *
 * SP `frontStatuses` → Pluralscape `custom_fronts`. A custom front is an
 * abstract cognitive state the user logs the same way as a member
 * (e.g. "Dissociated", "Blurry") — it has a name, description, colour,
 * and optional emoji.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";
import type { HexColor } from "@pluralscape/types";

export interface CustomFrontPayload {
  readonly encrypted: {
    readonly name: string;
    readonly description: string | null;
    readonly color: HexColor | null;
    readonly emoji: string | null;
  };
}

function isCustomFrontPayload(value: unknown): value is CustomFrontPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["name"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isCustomFrontPayload, "custom-front");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.customFront.create(ctx.systemId, encrypted);
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isCustomFrontPayload, "custom-front");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.customFront.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const customFrontPersister: EntityPersister = { create, update };
