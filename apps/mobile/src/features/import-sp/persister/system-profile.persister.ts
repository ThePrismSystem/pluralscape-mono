/**
 * System profile persister (update-only).
 *
 * The system row already exists for the current account — a fresh import
 * never creates a new system. The helper reads the current version to
 * satisfy optimistic locking, encrypts the payload, and issues
 * `system.update`. Calling `create` throws because the dispatch table
 * must route system-profile to `update`.
 */

import { assertPayloadShape, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

/**
 * Narrowed shape of the system-profile mapper output. Mirrors
 * `MappedSystemProfile` without importing it, to keep the persister
 * decoupled from the mapper module.
 */
export interface SystemProfilePayload {
  readonly name: string | null;
  readonly description: string | null;
  readonly pronouns: string | null;
  readonly avatarUrl: string | null;
}

function isSystemProfilePayload(value: unknown): value is SystemProfilePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    "name" in record && "description" in record && "pronouns" in record && "avatarUrl" in record
  );
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isSystemProfilePayload, "system-profile");
  const version = await ctx.api.system.getCurrentVersion(ctx.systemId);
  const encrypted = encryptForUpdate(narrowed, version, ctx.masterKey);
  const result = await ctx.api.system.update(ctx.systemId, encrypted);
  return { pluralscapeEntityId: result.id === "" ? existingId : result.id };
}

function rejectCreate(): Promise<PersisterCreateResult> {
  return Promise.reject(
    new Error("system-profile persister does not support create — route to update instead"),
  );
}

export const systemProfilePersister: EntityPersister = {
  create: rejectCreate,
  update,
};
