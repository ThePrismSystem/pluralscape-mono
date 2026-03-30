import { z } from "zod/v4";

import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

import type { ApiKeyScope } from "@pluralscape/types";

/** Key types matching the DB enum constraint. */
const API_KEY_KEY_TYPES = ["metadata", "crypto"] as const;

/**
 * All valid API key scopes — must stay in sync with `ApiKeyScope` in @pluralscape/types.
 * Uses `satisfies` to enforce compile-time alignment with the type union.
 */
const API_KEY_SCOPES = [
  "read:members",
  "write:members",
  "read:fronting",
  "write:fronting",
  "read:groups",
  "write:groups",
  "read:system",
  "write:system",
  "read:webhooks",
  "write:webhooks",
  "read:audit-log",
  "read:blobs",
  "write:blobs",
  "read:notifications",
  "write:notifications",
  "full",
] as const satisfies readonly ApiKeyScope[];

export const CreateApiKeyBodySchema = z
  .object({
    keyType: z.enum(API_KEY_KEY_TYPES),
    scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    encryptedKeyMaterial: z.string().min(1).optional(),
    expiresAt: z.number().int().positive().optional(),
    scopedBucketIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (data) =>
      (data.keyType === "crypto" && data.encryptedKeyMaterial !== undefined) ||
      (data.keyType === "metadata" && data.encryptedKeyMaterial === undefined),
    {
      message: "encryptedKeyMaterial is required for crypto keys and forbidden for metadata keys",
      path: ["encryptedKeyMaterial"],
    },
  )
  .readonly();
