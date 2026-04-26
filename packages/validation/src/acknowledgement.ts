import { z } from "zod/v4";

import { optionalBrandedId } from "./branded-id.js";
import { brandedString } from "./branded.js";
import { booleanQueryParam, optionalBooleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── Encrypted input ─────────────────────────────────────────────

/**
 * Runtime validator for the pre-encryption AcknowledgementRequest input.
 * Mirrors `AcknowledgementRequestEncryptedInput =
 * Pick<AcknowledgementRequest, "message" | "targetMemberId" | "confirmedAt">`.
 */
export const AcknowledgementRequestEncryptedInputSchema = z
  .object({
    message: z.string().min(1),
    targetMemberId: brandedString<"MemberId">(),
    confirmedAt: z.number().int().nullable(),
  })
  .readonly();

// ── Create ──────────────────────────────────────────────────────

export const CreateAcknowledgementBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    createdByMemberId: optionalBrandedId("mem_"),
  })
  .readonly();

// ── Confirm ─────────────────────────────────────────────────────

export const ConfirmAcknowledgementBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE).optional(),
  })
  .readonly();

// ── Query ───────────────────────────────────────────────────────

export const AcknowledgementQuerySchema = z.object({
  confirmed: optionalBooleanQueryParam,
  includeArchived: booleanQueryParam,
});
