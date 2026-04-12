/**
 * Group persister.
 *
 * SP `groups` → Pluralscape groups. The mapper has already resolved
 * the member ID list via the IdTranslationTable — unresolved members
 * were dropped with warnings upstream — so the payload's `memberIds`
 * is a ready-to-use array of Pluralscape IDs.
 *
 * The helper encrypts the group core (name, description, imageSource,
 * color, emoji) and passes the memberIds through as structural metadata
 * on the create mutation so the server can materialise the
 * group_memberships rows in the same transaction.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface GroupPayload {
  readonly encrypted: {
    readonly name: string;
    readonly description: string | null;
    readonly imageSource: string | null;
    readonly color: string | null;
    readonly emoji: string | null;
  };
  readonly parentGroupId: string | null;
  readonly sortOrder: number;
  readonly memberIds: readonly string[];
}

function isGroupPayload(value: unknown): value is GroupPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["name"] === "string" && Array.isArray(record["memberIds"]);
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isGroupPayload, "group");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.group.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
    memberIds: narrowed.memberIds,
    parentGroupId: narrowed.parentGroupId,
    sortOrder: narrowed.sortOrder,
  });
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isGroupPayload, "group");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.group.update(ctx.systemId, existingId, {
    encryptedData: encrypted.encryptedData,
    version: encrypted.version,
    memberIds: narrowed.memberIds,
  });
  return { pluralscapeEntityId: result.id };
}

export const groupPersister: EntityPersister = { create, update };
