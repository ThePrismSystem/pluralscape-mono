/**
 * Friend persister (record-only).
 *
 * SP friend records reference an external SP user by opaque ID. There
 * is no direct "create friend" mutation on Pluralscape — friend
 * connections require mutual consent via friend codes, so a one-way
 * import cannot materialise them as PS friend entities.
 *
 * Instead the helper records the source row via
 * `friend.recordExternalReference` and returns a synthetic placeholder
 * ID so the ref flow still works. A future phase may replace this with
 * a real "pending friend import" table on the server.
 */

import { assertPayloadShape } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

export interface FriendPayload {
  readonly externalUserId: string;
  readonly status: "accepted" | "pending";
  readonly seeMembers: boolean;
  readonly seeFront: boolean;
  readonly trusted: boolean;
  readonly getFrontNotif: boolean;
  readonly createdAt: number | null;
}

function isFriendPayload(value: unknown): value is FriendPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["externalUserId"] === "string" &&
    (record["status"] === "accepted" || record["status"] === "pending")
  );
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isFriendPayload, "friend");
  const result = await ctx.api.friend.recordExternalReference(
    ctx.systemId,
    narrowed.externalUserId,
    narrowed.status,
  );
  return { pluralscapeEntityId: result.placeholderId };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  // The record-only reference is idempotent; re-recording returns the
  // same placeholder ID.
  await create(ctx, payload);
  return { pluralscapeEntityId: existingId };
}

export const friendPersister: EntityPersister = { create, update };
