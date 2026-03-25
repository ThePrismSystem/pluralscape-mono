import { z } from "zod/v4";

import { brandedIdQueryParam, optionalBrandedId } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── Create ──────────────────────────────────────────────────────

export const CreateChannelBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    type: z.enum(["category", "channel"]),
    parentId: optionalBrandedId("ch_"),
    sortOrder: z.int().min(0),
  })
  .readonly();

// ── Update ──────────────────────────────────────────────────────

export const UpdateChannelBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
    sortOrder: z.int().min(0).optional(),
  })
  .readonly();

// ── Query ───────────────────────────────────────────────────────

export const ChannelQuerySchema = z.object({
  type: z.enum(["category", "channel"]).optional(),
  parentId: brandedIdQueryParam("ch_").optional(),
  includeArchived: booleanQueryParam,
});
