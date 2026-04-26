import { z } from "zod/v4";

import { optionalBrandedId, requireSubject, REQUIRE_SUBJECT_MESSAGE } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── Encrypted plaintext (T1 blob) ──────────────────────────────

/**
 * Runtime validator for the pre-encryption FrontingSession input. Every field
 * of `FrontingSessionEncryptedInput` (in `@pluralscape/types`) must be present
 * and well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/fronting-session.type.test.ts`.
 */
export const FrontingSessionEncryptedInputSchema = z
  .object({
    comment: z.string().nullable(),
    positionality: z.string().nullable(),
    outtrigger: z.string().nullable(),
    outtriggerSentiment: z.enum(["negative", "neutral", "positive"]).nullable(),
  })
  .readonly();

// ── Create ──────────────────────────────────────────────────────

export const CreateFrontingSessionBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    startTime: z.number().int().min(0),
    endTime: z.number().int().min(0).optional(),
    memberId: optionalBrandedId("mem_"),
    customFrontId: optionalBrandedId("cf_"),
    structureEntityId: optionalBrandedId("ste_"),
  })
  .refine(requireSubject, REQUIRE_SUBJECT_MESSAGE);

// ── Update ──────────────────────────────────────────────────────

export const UpdateFrontingSessionBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

// ── End session ─────────────────────────────────────────────────

export const EndFrontingSessionBodySchema = z
  .object({
    endTime: z.number().int().min(0),
    version: z.int().min(1),
  })
  .readonly();

// ── List query params ───────────────────────────────────────────

export const FrontingSessionQuerySchema = z.object({
  memberId: optionalBrandedId("mem_"),
  customFrontId: optionalBrandedId("cf_"),
  structureEntityId: optionalBrandedId("ste_"),
  startFrom: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(0))
    .optional(),
  startUntil: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(0))
    .optional(),
  endFrom: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(0))
    .optional(),
  endUntil: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(0))
    .optional(),
  activeOnly: booleanQueryParam,
  includeArchived: booleanQueryParam,
});
