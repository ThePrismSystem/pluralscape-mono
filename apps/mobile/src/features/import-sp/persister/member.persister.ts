/**
 * Member persister (with inline avatar upload and field-value fan-out).
 *
 * Receives the `MappedMember` the engine hands it — `{ encrypted, archived,
 * fieldValues, bucketIds }`, where `encrypted` is a `MemberEncryptedInput`
 * from `@pluralscape/data` (derived from the SoT `Member` type). The helper:
 *
 * 1. Resolves `encrypted.avatarSource` when it's an external URL. The
 *    caller's `AvatarFetcher` returns raw bytes; those are uploaded via
 *    `blob.uploadAvatar` and the resulting `BlobId` replaces the external
 *    URL inside the encrypted plaintext (so the server sees a consistent
 *    `ImageSource` discriminated union after decryption). Avatar failures
 *    NEVER fail the member — they are recorded via `recordError` and the
 *    member persists with `avatarSource` cleared.
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

import { brandId } from "@pluralscape/types";

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";
import type { MemberEncryptedInput } from "@pluralscape/data";
import type { BlobId, ImageSource } from "@pluralscape/types";

// ── Narrowed payload shape ───────────────────────────────────────────

export interface ExtractedFieldValuePayload {
  readonly memberSourceId: string;
  readonly fieldSourceId: string;
  readonly value: string;
}

export interface MemberPayload {
  readonly encrypted: MemberEncryptedInput;
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

/**
 * Resolves the plaintext `avatarSource` before encryption. For external
 * URLs the bytes are fetched and uploaded, converting the union to a
 * `blob` variant so the encrypted blob is self-contained. `blob` variants
 * pass through unchanged. Any failure records a non-fatal error and
 * clears the avatar — the member itself still imports.
 */
async function resolveAvatarSource(
  ctx: PersisterContext,
  memberSourceId: string,
  avatarSource: ImageSource | null,
): Promise<ImageSource | null> {
  if (avatarSource === null) return null;
  if (avatarSource.kind === "blob") return avatarSource;

  const fetchResult = await ctx.avatarFetcher.fetchAvatar(avatarSource.url);
  if (fetchResult.status === "not-found") return null;
  if (fetchResult.status === "error") {
    ctx.recordError({
      entityType: "member",
      entityId: memberSourceId,
      message: `avatar fetch failed: ${fetchResult.message}`,
      fatal: false,
    });
    return null;
  }
  try {
    const blob = await ctx.api.blob.uploadAvatar(ctx.systemId, {
      bytes: fetchResult.bytes,
      contentType: fetchResult.contentType,
    });
    return { kind: "blob" as const, blobRef: brandId<BlobId>(blob.blobId) };
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

  const resolvedAvatar = await resolveAvatarSource(ctx, sourceId, output.encrypted.avatarSource);
  const plaintext: MemberEncryptedInput = { ...output.encrypted, avatarSource: resolvedAvatar };
  const encrypted = encryptForCreate(plaintext, ctx.masterKey);
  const result = await ctx.api.member.create(ctx.systemId, {
    encryptedData: encrypted.encryptedData,
  });

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

  const resolvedAvatar = await resolveAvatarSource(ctx, sourceId, output.encrypted.avatarSource);
  const plaintext: MemberEncryptedInput = { ...output.encrypted, avatarSource: resolvedAvatar };
  const encrypted = encryptForUpdate(plaintext, 1, ctx.masterKey);
  const result = await ctx.api.member.update(ctx.systemId, existingId, {
    encryptedData: encrypted.encryptedData,
    version: encrypted.version,
  });

  await fanOutFieldValues(ctx, result.id, output.fieldValues);

  return { pluralscapeEntityId: result.id };
}

export const memberPersister: EntityPersister = { create, update };
