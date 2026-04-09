/**
 * System settings persister (update-only).
 *
 * The system settings row already exists for the current account. Like
 * `system-profile`, the helper reads the current version first, encrypts
 * the new settings, and issues `systemSettings.update`. `create` throws
 * because the dispatch table must route this entity to `update`.
 */

import { assertPayloadShape, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

/**
 * Narrowed shape of the system-settings mapper output. The concrete
 * field set is intentionally loose here — the persister blindly encrypts
 * whatever the mapper produced and passes it through.
 */
export interface SystemSettingsPayload {
  readonly [key: string]: unknown;
}

function isSystemSettingsPayload(value: unknown): value is SystemSettingsPayload {
  return typeof value === "object" && value !== null;
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isSystemSettingsPayload, "system-settings");
  const version = await ctx.api.systemSettings.getCurrentVersion(ctx.systemId);
  const encrypted = encryptForUpdate(narrowed, version, ctx.masterKey);
  const result = await ctx.api.systemSettings.update(ctx.systemId, encrypted);
  return { pluralscapeEntityId: result.id === "" ? existingId : result.id };
}

function rejectCreate(): Promise<PersisterCreateResult> {
  return Promise.reject(
    new Error("system-settings persister does not support create — route to update instead"),
  );
}

export const systemSettingsPersister: EntityPersister = {
  create: rejectCreate,
  update,
};
