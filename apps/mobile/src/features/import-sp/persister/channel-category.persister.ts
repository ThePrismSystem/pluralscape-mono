/**
 * Channel category persister.
 *
 * Channel categories are the folder-like parents for chat channels.
 * Pluralscape stores both categories and channels in the same
 * `channels` table with a `type` discriminator, so this helper
 * delegates to the shared `persistViaChannelsTable` writer with
 * `type: "category"`.
 *
 * Rejects payloads that carry a parent-channel reference — categories
 * never sit beneath another category.
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
  readonly name: string;
  readonly description: string | null;
  readonly type: "category" | "channel";
  readonly parentChannelId: string | null;
  readonly order: number | null;
}

function isChannelCategoryPayload(value: unknown): value is ChannelCategoryPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record["name"] === "string";
}

function assertNoParent(payload: ChannelCategoryPayload): void {
  if (payload.parentChannelId !== null) {
    throw new Error("channel-category persister received payload with non-null parentChannelId");
  }
}

const DEFAULT_SORT_ORDER = 0;

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isChannelCategoryPayload, "channel-category");
  assertNoParent(narrowed);
  const encrypted = encryptForCreate(
    { name: narrowed.name, description: narrowed.description },
    ctx.masterKey,
  );
  const result = await persistViaChannelsTable(
    ctx,
    {
      encryptedData: encrypted.encryptedData,
      parentId: null,
      sortOrder: narrowed.order ?? DEFAULT_SORT_ORDER,
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
  assertNoParent(narrowed);
  const encrypted = encryptForUpdate(
    { name: narrowed.name, description: narrowed.description },
    1,
    ctx.masterKey,
  );
  const result = await ctx.api.channel.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const channelCategoryPersister: EntityPersister = { create, update };
