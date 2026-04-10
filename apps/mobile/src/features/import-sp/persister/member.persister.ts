/**
 * Member persister (with inline avatar upload and field-value fan-out).
 *
 * Receives the `MappedMemberOutput` the engine hands it — `{ member,
 * fieldValues, bucketSourceIds }`. The helper:
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
 * Bucket assignments (the `bucketSourceIds` array) are deferred to a
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

export interface MemberCorePayload {
  readonly name: string;
  readonly description: string | null;
  readonly pronouns: string | null;
  readonly colors: readonly string[];
  readonly avatarUrl: string | null;
  readonly archived: boolean;
}

export interface ExtractedFieldValuePayload {
  readonly memberSourceId: string;
  readonly fieldSourceId: string;
  readonly value: string;
}

export interface MemberOutputPayload {
  readonly member: MemberCorePayload;
  readonly fieldValues: readonly ExtractedFieldValuePayload[];
  readonly bucketSourceIds: readonly string[];
}

function isMemberCorePayload(value: unknown): value is MemberCorePayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record["name"] === "string" && Array.isArray(record["colors"]);
}

function isMemberOutputPayload(value: unknown): value is MemberOutputPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    "member" in record &&
    isMemberCorePayload(record["member"]) &&
    Array.isArray(record["fieldValues"]) &&
    Array.isArray(record["bucketSourceIds"])
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
  const output = assertPayloadShape(payload, isMemberOutputPayload, "member");

  // Source-ID plumbed in for error messages even though the engine
  // already passes the same ID through via `sourceEntityId`. The
  // persister interface does not surface that here, so we fall back to
  // the member name.
  const sourceId = output.member.name;

  let avatarBlobId: string | null = null;
  if (output.member.avatarUrl !== null) {
    avatarBlobId = await tryUploadAvatar(ctx, sourceId, output.member.avatarUrl);
  }

  const encrypted = encryptForCreate(output.member, ctx.masterKey);
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
  const output = assertPayloadShape(payload, isMemberOutputPayload, "member");

  const sourceId = output.member.name;

  let avatarBlobId: string | null = null;
  if (output.member.avatarUrl !== null) {
    avatarBlobId = await tryUploadAvatar(ctx, sourceId, output.member.avatarUrl);
  }

  const encrypted = encryptForUpdate(output.member, 1, ctx.masterKey);
  const updateInput =
    avatarBlobId === null
      ? { encryptedData: encrypted.encryptedData, version: encrypted.version }
      : { encryptedData: encrypted.encryptedData, version: encrypted.version, avatarBlobId };
  const result = await ctx.api.member.update(ctx.systemId, existingId, updateInput);

  await fanOutFieldValues(ctx, result.id, output.fieldValues);

  return { pluralscapeEntityId: result.id };
}

export const memberPersister: EntityPersister = { create, update };
