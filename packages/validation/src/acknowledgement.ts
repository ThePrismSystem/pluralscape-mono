import { z } from "zod/v4";

import { optionalBrandedId } from "./branded-id.js";
import { booleanQueryParam, optionalBooleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

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
