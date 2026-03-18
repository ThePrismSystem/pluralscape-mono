import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

const RELATIONSHIP_TYPES = [
  "split-from",
  "fused-from",
  "sibling",
  "partner",
  "parent-child",
  "protector-of",
  "caretaker-of",
  "gatekeeper-of",
  "source",
  "custom",
] as const;

export const CreateRelationshipBodySchema = z
  .object({
    sourceMemberId: brandedString<"MemberId">(),
    targetMemberId: brandedString<"MemberId">(),
    type: z.enum(RELATIONSHIP_TYPES),
    bidirectional: z.boolean(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

export const UpdateRelationshipBodySchema = z
  .object({
    type: z.enum(RELATIONSHIP_TYPES),
    bidirectional: z.boolean(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();
