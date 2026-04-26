import { toUnixMillis } from "@pluralscape/types";
import { z } from "zod/v4";

import { optionalBrandedId } from "./branded-id.js";
import { brandedString } from "./branded.js";
import { booleanQueryParam } from "./query-params.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── Encrypted input ─────────────────────────────────────────────

/**
 * Runtime validator for the pre-encryption ChatMessage input.
 * Mirrors `ChatMessageEncryptedInput =
 * Pick<ChatMessage, "content" | "senderId" | "attachments" | "mentions">`.
 */
export const ChatMessageEncryptedInputSchema = z
  .object({
    content: z.string().min(1),
    senderId: brandedString<"MemberId">(),
    attachments: z.array(brandedString<"BlobId">()).readonly(),
    mentions: z.array(brandedString<"MemberId">()).readonly(),
  })
  .readonly();

// ── Create ──────────────────────────────────────────────────────

export const CreateMessageBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    timestamp: z.int().min(0),
    replyToId: optionalBrandedId("msg_"),
  })
  .readonly();

// ── Update ──────────────────────────────────────────────────────

export const UpdateMessageBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

// ── Query ───────────────────────────────────────────────────────

/** Query parameters for the message list endpoint. */
export const MessageQuerySchema = z.object({
  before: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0))
    .transform(toUnixMillis)
    .optional(),
  after: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0))
    .transform(toUnixMillis)
    .optional(),
  includeArchived: booleanQueryParam,
});

/** Optional timestamp query param for partition-efficient single-entity ops. */
export const MessageTimestampQuerySchema = z.object({
  timestamp: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(0))
    .transform(toUnixMillis)
    .optional(),
});
