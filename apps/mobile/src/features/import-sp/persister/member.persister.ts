/**
 * Member persister (with inline avatar upload and field-value fan-out).
 *
 * Receives the `MappedMemberOutput` the engine hands it — `{ encrypted,
 * archived, fieldValues, bucketIds }`. The helper:
 *
 * 1. Resolves the avatar URL if present and the mode is not "skip". The
 *    caller's `AvatarFetcher` returns raw bytes; those are uploaded via
 *    `blob.uploadAvatar` and the resulting `blobId` is attached to the
 *    member create/update payload. Avatar failures NEVER fail the member
 *    — they are recorded via `recordError` and the member persists
 *    without an avatar reference.
 * 2. Encrypts the member core and issues `member.create` / `member.update`.
 * 3. Fans out `field.setValue` for every extracted field value. Each
 *    field value depends on the field definition being present in the
 *    `IdTranslationTable` already — the persister translates the
 *    field source ID before calling the API and records an error (but
 *    does not abort the member) if it cannot be resolved.
 *
 * Bucket assignments (the `bucketIds` array) are deferred to a
 * future phase: the mobile persister does not yet expose a
 * `member.assignBucket` procedure, and Phase C scope is already dense.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

// ── Narrowed payload shape ───────────────────────────────────────────

export interface MemberEncryptedFields {
  readonly name: string;
  readonly pronouns: string[];
  readonly description: string | null;
  readonly avatarSource: string | null;
  readonly colors: readonly string[];
  readonly saturationLevel: number | null;
  readonly tags: readonly string[];
  readonly suppressFriendFrontNotification: boolean | null;
  readonly boardMessageNotificationOnFront: boolean | null;
}

export interface ExtractedFieldValuePayload {
  readonly memberSourceId: string;
  readonly fieldSourceId: string;
  readonly value: string;
}

export interface MemberPayload {
  readonly encrypted: MemberEncryptedFields;
  readonly archived: boolean;
  readonly fieldValues: readonly ExtractedFieldValuePayload[];
  readonly bucketIds: readonly string[];
}

function isMemberPayload(value: unknown): value is MemberPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return (
    typeof encrypted["name"] === "string" &&
    Array.isArray(record["fieldValues"]) &&
    Array.isArray(record["bucketIds"])
  );
}

// ── Avatar handling ──────────────────────────────────────────────────

async function tryUploadAvatar(
  ctx: PersisterContext,
  memberSourceId: string,
  avatarUrl: string,
): Promise<string | null> {
  const result = await ctx.avatarFetcher.fetchAvatar(avatarUrl);
  if (result.status === "not-found") {
    return null;
  }
  if (result.status === "error") {
    ctx.recordError({
      entityType: "member",
      entityId: memberSourceId,
      message: `avatar fetch failed: ${result.message}`,
      fatal: false,
    });
    return null;
  }
  try {
    const blob = await ctx.api.blob.uploadAvatar(ctx.systemId, {
      bytes: result.bytes,
      contentType: result.contentType,
    });
    return blob.blobId;
  } catch (err) {
    ctx.recordError({
      entityType: "member",
      entityId: memberSourceId,
      message: `avatar upload failed: ${err instanceof Error ? err.message : String(err)}`,
      fatal: false,
    });
    return null;
  }
}

// ── Field-value fan-out ──────────────────────────────────────────────

async function fanOutFieldValues(
  ctx: PersisterContext,
  memberPluralscapeId: string,
  fieldValues: readonly ExtractedFieldValuePayload[],
): Promise<void> {
  for (const fv of fieldValues) {
    const fieldDefinitionId = ctx.idTranslation.get("field-definition", fv.fieldSourceId);
    if (fieldDefinitionId === null) {
      ctx.recordError({
        entityType: "field-value",
        entityId: `${fv.memberSourceId}/${fv.fieldSourceId}`,
        message: `field-value references unresolved field ${fv.fieldSourceId}`,
        fatal: false,
      });
      continue;
    }
    try {
      const encrypted = encryptForCreate({ value: fv.value }, ctx.masterKey);
      await ctx.api.field.setValue(ctx.systemId, {
        memberId: memberPluralscapeId,
        fieldDefinitionId,
        encryptedData: encrypted.encryptedData,
      });
    } catch (err) {
      ctx.recordError({
        entityType: "field-value",
        entityId: `${fv.memberSourceId}/${fv.fieldSourceId}`,
        message: `field.setValue failed: ${err instanceof Error ? err.message : String(err)}`,
        fatal: false,
      });
    }
  }
}

// ── Core entity-persister shape ──────────────────────────────────────

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const output = assertPayloadShape(payload, isMemberPayload, "member");

  // Source-ID plumbed in for error messages even though the engine
  // already passes the same ID through via `sourceEntityId`. The
  // persister interface does not surface that here, so we fall back to
  // the member name.
  const sourceId = output.encrypted.name;

  let avatarBlobId: string | null = null;
  if (output.encrypted.avatarSource !== null) {
    avatarBlobId = await tryUploadAvatar(ctx, sourceId, output.encrypted.avatarSource);
  }

  const encrypted = encryptForCreate(output.encrypted, ctx.masterKey);
  const createInput =
    avatarBlobId === null
      ? { encryptedData: encrypted.encryptedData }
      : { encryptedData: encrypted.encryptedData, avatarBlobId };
  const result = await ctx.api.member.create(ctx.systemId, createInput);

  await fanOutFieldValues(ctx, result.id, output.fieldValues);

  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const output = assertPayloadShape(payload, isMemberPayload, "member");

  const sourceId = output.encrypted.name;

  let avatarBlobId: string | null = null;
  if (output.encrypted.avatarSource !== null) {
    avatarBlobId = await tryUploadAvatar(ctx, sourceId, output.encrypted.avatarSource);
  }

  const encrypted = encryptForUpdate(output.encrypted, 1, ctx.masterKey);
  const updateInput =
    avatarBlobId === null
      ? { encryptedData: encrypted.encryptedData, version: encrypted.version }
      : { encryptedData: encrypted.encryptedData, version: encrypted.version, avatarBlobId };
  const result = await ctx.api.member.update(ctx.systemId, existingId, updateInput);

  await fanOutFieldValues(ctx, result.id, output.fieldValues);

  return { pluralscapeEntityId: result.id };
}

export const memberPersister: EntityPersister = { create, update };
