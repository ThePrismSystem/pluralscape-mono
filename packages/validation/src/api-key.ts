import { ALL_API_KEY_SCOPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

import type { ApiKeyEncryptedPayload } from "@pluralscape/types";

/** Key types matching the DB enum constraint. */
const API_KEY_KEY_TYPES = ["metadata", "crypto"] as const;

export const CreateApiKeyBodySchema = z
  .object({
    keyType: z.enum(API_KEY_KEY_TYPES),
    scopes: z.array(z.enum(ALL_API_KEY_SCOPES)).min(1),
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

/**
 * Zod parity for `ApiKeyEncryptedPayload` — the Class C auxiliary type
 * encrypted inside an ApiKey row's `encryptedData` blob. Discriminated
 * over `keyType`: `"metadata"` carries `name`; `"crypto"` adds
 * `publicKey: Uint8Array`. The compile-time parity test asserts
 * `z.infer<typeof ApiKeyEncryptedPayloadSchema>` equals
 * `ApiKeyEncryptedPayload`.
 */
export const ApiKeyEncryptedPayloadSchema: z.ZodType<ApiKeyEncryptedPayload> = z.discriminatedUnion(
  "keyType",
  [
    z
      .object({
        keyType: z.literal("metadata"),
        name: z.string(),
      })
      .readonly(),
    z
      .object({
        keyType: z.literal("crypto"),
        name: z.string(),
        publicKey: z.instanceof(Uint8Array),
      })
      .readonly(),
  ],
);
