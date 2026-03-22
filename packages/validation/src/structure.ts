import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

// ── Structure Entity Type ────────────────────────────────────────────

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
