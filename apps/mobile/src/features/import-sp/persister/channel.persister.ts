/**
 * Channel persister.
 *
 * Delegates to the shared `persistViaChannelsTable` writer with
 * `type: "channel"`. The mapper has already resolved the parent
 * category FK against the IdTranslationTable, so the payload's
 * `parentId` is either null (orphan) or a Pluralscape ID.
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
  readonly encrypted: {
    readonly name: string;
  };
  readonly type: "category" | "channel";
  readonly parentId?: string | null;
  readonly sortOrder: number;
}

function isChannelPayload(value: unknown): value is ChannelPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["name"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isChannelPayload, "channel");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await persistViaChannelsTable(
    ctx,
    {
      encryptedData: encrypted.encryptedData,
      parentId: narrowed.parentId ?? null,
      sortOrder: narrowed.sortOrder,
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
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.channel.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const channelPersister: EntityPersister = { create, update };
