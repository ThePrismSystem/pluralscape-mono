/**
 * Channel persister.
 *
 * Delegates to the shared `persistViaChannelsTable` writer with
 * `type: "channel"`. The mapper has already resolved the parent
 * category FK against the IdTranslationTable, so the payload's
 * `parentChannelId` is either null (orphan) or a Pluralscape ID.
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

export interface ChannelPayload {
  readonly name: string;
  readonly description: string | null;
  readonly type: "category" | "channel";
  readonly parentChannelId: string | null;
  readonly order: number | null;
}

function isChannelPayload(value: unknown): value is ChannelPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record["name"] === "string";
}

const DEFAULT_SORT_ORDER = 0;

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isChannelPayload, "channel");
  const encrypted = encryptForCreate(
    { name: narrowed.name, description: narrowed.description },
    ctx.masterKey,
  );
  const result = await persistViaChannelsTable(
    ctx,
    {
      encryptedData: encrypted.encryptedData,
      parentId: narrowed.parentChannelId,
      sortOrder: narrowed.order ?? DEFAULT_SORT_ORDER,
    },
    "channel",
  );
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isChannelPayload, "channel");
  const encrypted = encryptForUpdate(
    { name: narrowed.name, description: narrowed.description },
    1,
    ctx.masterKey,
  );
  const result = await ctx.api.channel.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const channelPersister: EntityPersister = { create, update };
