import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { HexColorSchema, PlaintextImageSourceSchema } from "./plaintext-shared.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── Structure Entity Type ────────────────────────────────────────────

/**
 * Runtime validator for the pre-encryption SystemStructureEntityType input.
 * Every field of `StructureEntityTypeEncryptedInput` (in `@pluralscape/data`)
 * must be present and well-formed. Zod compile-time parity is checked in
 * `__tests__/type-parity/structure-entity-type.type.test.ts`.
 *
 * Replaces the hand-written `assertStructureEntityTypeEncryptedFields` that
 * used to live in `packages/data/src/transforms/structure-entity-type.ts`.
 */
export const StructureEntityTypeEncryptedInputSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().nullable(),
    emoji: z.string().nullable(),
    color: HexColorSchema.nullable(),
    imageSource: PlaintextImageSourceSchema.nullable(),
  })
  .readonly();

export const CreateStructureEntityTypeBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    sortOrder: z.int().min(0),
  })
  .readonly();

export const UpdateStructureEntityTypeBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    sortOrder: z.int().min(0),
    version: z.int().min(1),
  })
  .readonly();

// ── Structure Entity ────────────────────────────────────────────────

export const CreateStructureEntityBodySchema = z
  .object({
    structureEntityTypeId: brandedString<"SystemStructureEntityTypeId">(),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    parentEntityId: brandedString<"SystemStructureEntityId">().nullable(),
    sortOrder: z.int().min(0),
  })
  .readonly();

export const UpdateStructureEntityBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    parentEntityId: brandedString<"SystemStructureEntityId">().nullable(),
    sortOrder: z.int().min(0),
    version: z.int().min(1),
  })
  .readonly();
