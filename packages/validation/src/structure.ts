import { z } from "zod/v4";

import { brandedString } from "./branded.js";
import {
  MAX_CUSTOM_ARCHITECTURE_TYPE_LENGTH,
  MAX_ENCRYPTED_DATA_SIZE,
} from "./validation.constants.js";

const KNOWN_ARCHITECTURE_TYPES = [
  "orbital",
  "spectrum",
  "median",
  "age-sliding",
  "webbed",
  "unknown",
  "fluid",
] as const;

const DISCOVERY_STATUSES = ["fully-mapped", "partially-mapped", "unknown"] as const;

const KnownArchitectureTypeSchema = z.object({
  kind: z.literal("known"),
  type: z.enum(KNOWN_ARCHITECTURE_TYPES),
});

const CustomArchitectureTypeSchema = z.object({
  kind: z.literal("custom"),
  value: z.string().min(1).max(MAX_CUSTOM_ARCHITECTURE_TYPE_LENGTH),
});

const ArchitectureTypeSchema = z.discriminatedUnion("kind", [
  KnownArchitectureTypeSchema,
  CustomArchitectureTypeSchema,
]);

// ── Structure Entity Type ────────────────────────────────────────────

export const CreateStructureEntityTypeBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    architectureType: ArchitectureTypeSchema.nullable(),
    discoveryStatus: z.enum(DISCOVERY_STATUSES).nullable(),
  })
  .readonly();

export const UpdateStructureEntityTypeBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    architectureType: ArchitectureTypeSchema.nullable(),
    discoveryStatus: z.enum(DISCOVERY_STATUSES).nullable(),
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
