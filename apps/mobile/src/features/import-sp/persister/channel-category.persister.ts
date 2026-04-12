/**
 * Channel category persister.
 *
 * Channel categories are the folder-like parents for chat channels.
 * Pluralscape stores both categories and channels in the same
 * `channels` table with a `type` discriminator, so this helper
 * delegates to the shared `persistViaChannelsTable` writer with
 * `type: "category"`.
 */

import {
  assertPayloadShape,
  encryptForCreate,
  encryptForUpdate,
  persistViaChannelsTable,
} from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface ChannelCategoryPayload {
  readonly encrypted: {
    readonly name: string;
  };
  readonly type: "category" | "channel";
  readonly parentId?: string | null;
  readonly sortOrder: number;
}

function isChannelCategoryPayload(value: unknown): value is ChannelCategoryPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["name"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isChannelCategoryPayload, "channel-category");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await persistViaChannelsTable(
    ctx,
    {
      encryptedData: encrypted.encryptedData,
      parentId: narrowed.parentId ?? null,
      sortOrder: narrowed.sortOrder,
    },
    "category",
  );
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isChannelCategoryPayload, "channel-category");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.channel.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const channelCategoryPersister: EntityPersister = { create, update };
