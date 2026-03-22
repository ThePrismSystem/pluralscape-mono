import { z } from "zod/v4";

import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

import type { Brand, IdPrefixBrandMap } from "@pluralscape/types";

// ── Branded ID helpers ──────────────────────────────────────────

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

export const CreateFrontingCommentBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    memberId: optionalBrandedId("mem_"),
    customFrontId: optionalBrandedId("cf_"),
    structureEntityId: optionalBrandedId("ste_"),
  })
  .refine(
    (data) => Boolean(data.memberId ?? data.customFrontId ?? data.structureEntityId),
    "At least one of memberId, customFrontId, or structureEntityId is required",
  );

// ── Update ──────────────────────────────────────────────────────

export const UpdateFrontingCommentBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();
