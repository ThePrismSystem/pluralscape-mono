import { ALL_API_KEY_SCOPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

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
