import { z } from "zod/v4";

import { optionalBrandedId, requireSubject, REQUIRE_SUBJECT_MESSAGE } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

/**
 * Runtime validator for the pre-encryption FrontingComment input. Every field
 * of `FrontingCommentEncryptedInput` (in `@pluralscape/types`) must be present
 * and well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/fronting-comment.type.test.ts`.
 *
 * Replaces the hand-written `assertFrontingCommentPlaintext` that used to live
 * in `packages/data/src/transforms/fronting-comment.ts`.
 */
export const FrontingCommentEncryptedInputSchema = z
  .object({
    content: z.string(),
  })
  .readonly();

// ── Create ──────────────────────────────────────────────────────

export const CreateFrontingCommentBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    memberId: optionalBrandedId("mem_"),
    customFrontId: optionalBrandedId("cf_"),
    structureEntityId: optionalBrandedId("ste_"),
  })
  .refine(requireSubject, REQUIRE_SUBJECT_MESSAGE);

// ── Update ──────────────────────────────────────────────────────

export const UpdateFrontingCommentBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

// ── Query ──────────────────────────────────────────────────────

export const FrontingCommentQuerySchema = z.object({
  includeArchived: booleanQueryParam,
});
