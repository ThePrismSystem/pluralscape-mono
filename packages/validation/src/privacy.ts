import { BUCKET_CONTENT_ENTITY_TYPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

import type { BucketContentEntityType } from "@pluralscape/types";

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

/**
 * Validates the body for tagging content into a privacy bucket.
 *
 * Discriminated by `entityType`: each variant's `entityId` must be a
 * branded ID with the prefix matching its entity type. The runtime
 * validator mirrors the canonical {@link import("@pluralscape/types").TaggedEntityRef}
 * union from `@pluralscape/types`.
 */
export const TagContentBodySchema = z
  .discriminatedUnion("entityType", [
    z.object({ entityType: z.literal("member"), entityId: brandedIdQueryParam("mem_") }).readonly(),
    z.object({ entityType: z.literal("group"), entityId: brandedIdQueryParam("grp_") }).readonly(),
    z.object({ entityType: z.literal("channel"), entityId: brandedIdQueryParam("ch_") }).readonly(),
    z
      .object({ entityType: z.literal("message"), entityId: brandedIdQueryParam("msg_") })
      .readonly(),
    z.object({ entityType: z.literal("note"), entityId: brandedIdQueryParam("note_") }).readonly(),
    z.object({ entityType: z.literal("poll"), entityId: brandedIdQueryParam("poll_") }).readonly(),
    z
      .object({ entityType: z.literal("relationship"), entityId: brandedIdQueryParam("rel_") })
      .readonly(),
    z
      .object({
        entityType: z.literal("structure-entity-type"),
        entityId: brandedIdQueryParam("stet_"),
      })
      .readonly(),
    z
      .object({ entityType: z.literal("structure-entity"), entityId: brandedIdQueryParam("ste_") })
      .readonly(),
    z
      .object({ entityType: z.literal("journal-entry"), entityId: brandedIdQueryParam("je_") })
      .readonly(),
    z
      .object({ entityType: z.literal("wiki-page"), entityId: brandedIdQueryParam("wp_") })
      .readonly(),
    z
      .object({ entityType: z.literal("custom-front"), entityId: brandedIdQueryParam("cf_") })
      .readonly(),
    z
      .object({ entityType: z.literal("fronting-session"), entityId: brandedIdQueryParam("fs_") })
      .readonly(),
    z
      .object({ entityType: z.literal("board-message"), entityId: brandedIdQueryParam("bm_") })
      .readonly(),
    z
      .object({ entityType: z.literal("acknowledgement"), entityId: brandedIdQueryParam("ack_") })
      .readonly(),
    z
      .object({ entityType: z.literal("innerworld-entity"), entityId: brandedIdQueryParam("iwe_") })
      .readonly(),
    z
      .object({ entityType: z.literal("innerworld-region"), entityId: brandedIdQueryParam("iwr_") })
      .readonly(),
    z
      .object({ entityType: z.literal("field-definition"), entityId: brandedIdQueryParam("fld_") })
      .readonly(),
    z
      .object({ entityType: z.literal("field-value"), entityId: brandedIdQueryParam("fv_") })
      .readonly(),
    z
      .object({ entityType: z.literal("member-photo"), entityId: brandedIdQueryParam("mp_") })
      .readonly(),
    z
      .object({ entityType: z.literal("fronting-comment"), entityId: brandedIdQueryParam("fcom_") })
      .readonly(),
  ])
  .readonly();

/**
 * Compile-time check that {@link TagContentBodySchema} covers every
 * {@link BucketContentEntityType} variant. If a new entity type is
 * added to the union without a matching schema arm, this assignment
 * fails typecheck.
 */
type _AssertTagContentEntityTypesCovered = z.infer<
  typeof TagContentBodySchema
>["entityType"] extends BucketContentEntityType
  ? BucketContentEntityType extends z.infer<typeof TagContentBodySchema>["entityType"]
    ? true
    : never
  : never;
const _ASSERT_TAG_CONTENT_ENTITY_TYPES_COVERED: _AssertTagContentEntityTypesCovered = true;
void _ASSERT_TAG_CONTENT_ENTITY_TYPES_COVERED;

export const BucketContentTagQuerySchema = z.object({
  entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES).optional(),
});

// ── Field bucket visibility ──────────────────────────────────────

export const SetFieldBucketVisibilityBodySchema = z
  .object({
    bucketId: brandedIdQueryParam("bkt_"),
  })
  .readonly();
