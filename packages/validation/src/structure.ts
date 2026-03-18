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

// ── Subsystem ────────────────────────────────────────────────────────

export const CreateSubsystemBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    parentSubsystemId: brandedString<"SubsystemId">().nullable(),
    architectureType: ArchitectureTypeSchema.nullable(),
    hasCore: z.boolean(),
    discoveryStatus: z.enum(DISCOVERY_STATUSES).nullable(),
  })
  .readonly();

export const UpdateSubsystemBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    parentSubsystemId: brandedString<"SubsystemId">().nullable(),
    architectureType: ArchitectureTypeSchema.nullable(),
    hasCore: z.boolean(),
    discoveryStatus: z.enum(DISCOVERY_STATUSES).nullable(),
    version: z.int().min(1),
  })
  .readonly();

// ── Side System ──────────────────────────────────────────────────────

export const CreateSideSystemBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

export const UpdateSideSystemBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    version: z.int().min(1),
  })
  .readonly();

// ── Layer ────────────────────────────────────────────────────────────

export const CreateLayerBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    sortOrder: z.int().min(0),
  })
  .readonly();

export const UpdateLayerBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
    sortOrder: z.int().min(0),
    version: z.int().min(1),
  })
  .readonly();
