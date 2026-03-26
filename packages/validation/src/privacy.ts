import { BUCKET_CONTENT_ENTITY_TYPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

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
});

// ── Content tags ─────────────────────────────────────────────────

export const TagContentBodySchema = z
  .object({
    entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES),
    entityId: z.string().min(1),
  })
  .readonly();

export const BucketContentTagQuerySchema = z
  .object({
    entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES).optional(),
    entityId: z.string().optional(),
  })
  .refine((v) => v.entityId === undefined || v.entityType !== undefined, {
    message: "entityId requires entityType",
  });

// ── Field bucket visibility ──────────────────────────────────────

export const SetFieldBucketVisibilityBodySchema = z
  .object({
    bucketId: z.string().min(1),
  })
  .readonly();
