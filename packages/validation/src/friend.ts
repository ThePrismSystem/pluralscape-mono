import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { booleanQueryParam } from "./query-params.js";
import {
  FRIEND_CONNECTION_DEFAULT_LIMIT,
  FRIEND_CONNECTION_MAX_LIMIT,
  MAX_ENCRYPTED_DATA_SIZE,
} from "./validation.constants.js";

// ── Friend code format ──────────────────────────────────────────────

/** Four uppercase-alphanumeric characters, dash, four more: XXXX-XXXX. */
const FRIEND_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

// ── Friend code schemas ─────────────────────────────────────────────

export const RedeemFriendCodeBodySchema = z
  .object({
    code: z.string().regex(FRIEND_CODE_PATTERN, "Expected XXXX-XXXX alphanumeric code"),
  })
  .readonly();

// ── Friend connection schemas ───────────────────────────────────────

export const UpdateFriendVisibilityBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

export const FriendConnectionQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(FRIEND_CONNECTION_MAX_LIMIT)
    .default(FRIEND_CONNECTION_DEFAULT_LIMIT),
});

export const FriendCodeQuerySchema = z.object({
  includeExpired: booleanQueryParam,
});

// ── Bucket assignment schemas ───────────────────────────────────────

export const AssignBucketBodySchema = z
  .object({
    bucketId: brandedIdQueryParam("bkt_"),
    encryptedBucketKey: z.string().min(1),
    keyVersion: z.int().min(1),
  })
  .readonly();
