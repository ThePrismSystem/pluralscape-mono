import { z } from "zod/v4";

import { optionalBrandedId, requireSubject, REQUIRE_SUBJECT_MESSAGE } from "./branded-id.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

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
