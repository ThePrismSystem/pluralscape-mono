import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

export const RELATIONSHIP_TYPES = [
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

/**
 * Runtime validator for the pre-encryption Relationship input. Every field
 * of `RelationshipEncryptedInput` (in `@pluralscape/data`) must be present
 * and well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/relationship.type.test.ts`.
 */
export const RelationshipEncryptedInputSchema = z
  .object({
    label: z.string().nullable(),
  })
  .readonly();

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
