import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE, MAX_REORDER_OPERATIONS } from "./validation.constants.js";

// ── Encrypted input ─────────────────────────────────────────────

/**
 * Runtime validator for the pre-encryption BoardMessage input.
 * Mirrors `BoardMessageEncryptedInput = Pick<BoardMessage, "senderId" | "content">`.
 */
export const BoardMessageEncryptedInputSchema = z
  .object({
    senderId: brandedString<"MemberId">(),
    content: z.string().min(1),
  })
  .readonly();

// ── Create ──────────────────────────────────────────────────────

export const CreateBoardMessageBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    sortOrder: z.int().min(0),
    pinned: z.boolean().optional().default(false),
  })
  .readonly();

// ── Update ──────────────────────────────────────────────────────

export const UpdateBoardMessageBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
    sortOrder: z.int().min(0).optional(),
    pinned: z.boolean().optional(),
  })
  .readonly();

// ── Reorder ─────────────────────────────────────────────────────

export const ReorderBoardMessagesBodySchema = z
  .object({
    operations: z
      .array(
        z.object({
          boardMessageId: brandedString<"BoardMessageId">(),
          sortOrder: z.int().min(0),
        }),
      )
      .min(1)
      .max(MAX_REORDER_OPERATIONS),
  })
  .readonly();

// ── Query ───────────────────────────────────────────────────────

export const BoardMessageQuerySchema = z.object({
  includeArchived: booleanQueryParam,
  pinned: booleanQueryParam.optional(),
});
