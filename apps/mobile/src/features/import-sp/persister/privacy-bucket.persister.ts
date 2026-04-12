/**
 * Privacy bucket persister.
 *
 * Buckets are the intersection-tag entities mapped from SP's
 * `privacyBuckets` collection, including the three synthetic legacy
 * buckets the engine injects when an SP export lacks modern privacy
 * data. The helper encrypts the bucket fields and issues
 * `bucket.create` / `bucket.update`.
 */

import { assertPayloadShape, encryptForCreate, encryptForUpdate } from "./persister-helpers.js";

import type {
  EntityPersister,
  PersisterContext,
  PersisterCreateResult,
  PersisterUpdateResult,
} from "./persister.types.js";

/**
 * Narrowed shape of `MappedBucket` from the engine. Re-declared here so
 * the persister does not depend on the mapper module.
 */
export interface PrivacyBucketPayload {
  readonly encrypted: {
    readonly name: string;
    readonly description: string | null;
  };
}

function isPrivacyBucketPayload(value: unknown): value is PrivacyBucketPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record["encrypted"] !== "object" || record["encrypted"] === null) return false;
  const encrypted = record["encrypted"] as Record<string, unknown>;
  return typeof encrypted["name"] === "string";
}

async function create(ctx: PersisterContext, payload: unknown): Promise<PersisterCreateResult> {
  const narrowed = assertPayloadShape(payload, isPrivacyBucketPayload, "privacy-bucket");
  const encrypted = encryptForCreate(narrowed.encrypted, ctx.masterKey);
  const result = await ctx.api.bucket.create(ctx.systemId, encrypted);
  return { pluralscapeEntityId: result.id };
}

async function update(
  ctx: PersisterContext,
  payload: unknown,
  existingId: string,
): Promise<PersisterUpdateResult> {
  const narrowed = assertPayloadShape(payload, isPrivacyBucketPayload, "privacy-bucket");
  const encrypted = encryptForUpdate(narrowed.encrypted, 1, ctx.masterKey);
  const result = await ctx.api.bucket.update(ctx.systemId, existingId, encrypted);
  return { pluralscapeEntityId: result.id };
}

export const privacyBucketPersister: EntityPersister = { create, update };
