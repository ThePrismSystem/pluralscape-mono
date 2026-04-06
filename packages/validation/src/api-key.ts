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
  // Per-entity triplets (22 domains x 3 = 66)
  "read:members",
  "write:members",
  "delete:members",
  "read:fronting",
  "write:fronting",
  "delete:fronting",
  "read:groups",
  "write:groups",
  "delete:groups",
  "read:system",
  "write:system",
  "delete:system",
  "read:structure",
  "write:structure",
  "delete:structure",
  "read:reports",
  "write:reports",
  "delete:reports",
  "read:webhooks",
  "write:webhooks",
  "delete:webhooks",
  "read:blobs",
  "write:blobs",
  "delete:blobs",
  "read:notifications",
  "write:notifications",
  "delete:notifications",
  "read:acknowledgements",
  "write:acknowledgements",
  "delete:acknowledgements",
  "read:channels",
  "write:channels",
  "delete:channels",
  "read:messages",
  "write:messages",
  "delete:messages",
  "read:notes",
  "write:notes",
  "delete:notes",
  "read:polls",
  "write:polls",
  "delete:polls",
  "read:relationships",
  "write:relationships",
  "delete:relationships",
  "read:innerworld",
  "write:innerworld",
  "delete:innerworld",
  "read:fields",
  "write:fields",
  "delete:fields",
  "read:check-ins",
  "write:check-ins",
  "delete:check-ins",
  "read:lifecycle-events",
  "write:lifecycle-events",
  "delete:lifecycle-events",
  "read:timers",
  "write:timers",
  "delete:timers",
  "read:buckets",
  "write:buckets",
  "delete:buckets",
  "read:friends",
  "write:friends",
  "delete:friends",
  // Read-only domain
  "read:audit-log",
  // Aggregates
  "read-all",
  "write-all",
  "delete-all",
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
