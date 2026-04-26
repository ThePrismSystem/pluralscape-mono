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
 * Runtime validator for the custom-type pre-encryption Relationship input.
 * The `type` discriminant is plaintext on the wire (not inside the blob), so
 * callers must select the correct schema before parsing the decrypted payload.
 */
export const CustomRelationshipEncryptedSchema = z.object({ label: z.string() }).readonly();

/**
 * Runtime validator for a standard-type pre-encryption Relationship input.
 * Standard relationships carry no label — the blob MUST be an empty object.
 * Strict mode rejects any extra keys (defense against schema drift or
 * misrouted custom blobs).
 */
export const StandardRelationshipEncryptedSchema = z.object({}).strict().readonly();

/**
 * Union of both encrypted-input schemas. `z.infer` yields `{ label: string } | {}`,
 * matching the distributive `RelationshipEncryptedInput` canonical type.
 * Zod compile-time parity checked in `__tests__/type-parity/relationship.type.test.ts`.
 */
export const RelationshipEncryptedInputSchema = z.union([
  CustomRelationshipEncryptedSchema,
  StandardRelationshipEncryptedSchema,
]);

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
