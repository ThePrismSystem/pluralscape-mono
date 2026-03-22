import { z } from "zod/v4";

import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

import type { Brand, IdPrefixBrandMap } from "@pluralscape/types";

// ── Branded ID helpers ──────────────────────────────────────────

/** UUID pattern (lowercase hex, 8-4-4-4-12, any version). */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function optionalBrandedId<P extends keyof IdPrefixBrandMap>(
  prefix: P,
): z.ZodType<Brand<string, IdPrefixBrandMap[P]> | undefined> {
  return z
    .custom<Brand<string, IdPrefixBrandMap[P]>>((val) => {
      if (typeof val !== "string") return false;
      return val.startsWith(prefix) && UUID_REGEX.test(val.slice(prefix.length));
    }, `Expected a valid ${prefix}<uuid> identifier`)
    .optional();
}

// ── Create ──────────────────────────────────────────────────────

export const CreateFrontingSessionBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    startTime: z.number().int().min(0),
    memberId: optionalBrandedId("mem_"),
    customFrontId: optionalBrandedId("cf_"),
    structureEntityId: optionalBrandedId("ste_"),
  })
  .refine(
    (data) => Boolean(data.memberId ?? data.customFrontId ?? data.structureEntityId),
    "At least one of memberId, customFrontId, or structureEntityId is required",
  );

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
  startAfter: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(0))
    .optional(),
  startBefore: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.number().int().min(0))
    .optional(),
  activeOnly: booleanQueryParam,
  includeArchived: booleanQueryParam,
});
