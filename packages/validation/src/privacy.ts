import { BUCKET_CONTENT_ENTITY_TYPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

/**
 * Runtime validator for the pre-encryption PrivacyBucket input. Every field
 * of `PrivacyBucketEncryptedInput` (in `@pluralscape/types`) must be present
 * and well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/privacy-bucket.type.test.ts`.
 *
 * Replaces the hand-written `assertBucketEncryptedFields` that used to live
 * in `packages/data/src/transforms/privacy-bucket.ts`.
 */
export const PrivacyBucketEncryptedInputSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
  })
  .readonly();

// ── Bucket CRUD ──────────────────────────────────────────────────

export const CreateBucketBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

export const UpdateBucketBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const BucketQuerySchema = z.object({
  includeArchived: booleanQueryParam,
  archivedOnly: booleanQueryParam,
});

// ── Content tags ─────────────────────────────────────────────────

export const TagContentBodySchema = z
  .object({
    entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES),
    entityId: z
      .string()
      .min(1)
      .regex(/^[a-z]{2,6}_[a-zA-Z0-9-]+$/),
  })
  .readonly();

export const BucketContentTagQuerySchema = z.object({
  entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES).optional(),
});

// ── Field bucket visibility ──────────────────────────────────────

export const SetFieldBucketVisibilityBodySchema = z
  .object({
    bucketId: brandedIdQueryParam("bkt_"),
  })
  .readonly();
