import { z } from "zod/v4";

const IMPORT_SOURCE_VALUES = ["simply-plural", "pluralkit", "pluralscape"] as const;

const IMPORT_STATUS_VALUES = ["pending", "validating", "importing", "completed", "failed"] as const;

const IMPORT_ENTITY_TYPE_VALUES = [
  "member",
  "group",
  "fronting-session",
  "switch",
  "custom-field",
  "note",
  "chat-message",
  "board-message",
  "poll",
  "timer",
  "privacy-bucket",
  "friend",
  "unknown",
] as const;

const IMPORT_AVATAR_MODE_VALUES = ["api", "zip", "skip"] as const;

const IMPORT_CHECKPOINT_SCHEMA_VERSION = 1 as const;

const PROGRESS_PERCENT_MIN = 0;
const PROGRESS_PERCENT_MAX = 100;

const ImportErrorSchema = z
  .object({
    entityType: z.enum(IMPORT_ENTITY_TYPE_VALUES),
    entityId: z.string().nullable(),
    message: z.string().min(1),
    fatal: z.boolean(),
    recoverable: z.boolean(),
  })
  .readonly();

const ImportCollectionTotalsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    imported: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  })
  .readonly();

const ImportCheckpointStateSchema = z
  .object({
    schemaVersion: z.literal(IMPORT_CHECKPOINT_SCHEMA_VERSION),
    checkpoint: z
      .object({
        completedCollections: z.array(z.enum(IMPORT_ENTITY_TYPE_VALUES)),
        currentCollection: z.enum(IMPORT_ENTITY_TYPE_VALUES),
        currentCollectionLastSourceId: z.string().nullable(),
      })
      .readonly(),
    options: z
      .object({
        selectedCategories: z.record(z.string(), z.boolean()),
        avatarMode: z.enum(IMPORT_AVATAR_MODE_VALUES),
      })
      .readonly(),
    totals: z
      .object({
        perCollection: z.record(z.string(), ImportCollectionTotalsSchema),
      })
      .readonly(),
  })
  .readonly();

export const CreateImportJobBodySchema = z
  .object({
    source: z.enum(IMPORT_SOURCE_VALUES),
    selectedCategories: z.record(z.string(), z.boolean()),
    avatarMode: z.enum(IMPORT_AVATAR_MODE_VALUES),
  })
  .readonly();

export const UpdateImportJobBodySchema = z
  .object({
    status: z.enum(IMPORT_STATUS_VALUES).optional(),
    progressPercent: z
      .number()
      .int()
      .min(PROGRESS_PERCENT_MIN)
      .max(PROGRESS_PERCENT_MAX)
      .optional(),
    warningCount: z.number().int().nonnegative().optional(),
    chunksTotal: z.number().int().nonnegative().nullable().optional(),
    chunksCompleted: z.number().int().nonnegative().optional(),
    errorLog: z.array(ImportErrorSchema).nullable().optional(),
    checkpointState: ImportCheckpointStateSchema.nullable().optional(),
  })
  .readonly()
  .refine(
    (value) =>
      value.status !== undefined ||
      value.progressPercent !== undefined ||
      value.warningCount !== undefined ||
      value.chunksTotal !== undefined ||
      value.chunksCompleted !== undefined ||
      value.errorLog !== undefined ||
      value.checkpointState !== undefined,
    { message: "At least one field must be provided" },
  );

export const ImportJobQuerySchema = z
  .object({
    status: z.enum(IMPORT_STATUS_VALUES).optional(),
    source: z.enum(IMPORT_SOURCE_VALUES).optional(),
  })
  .readonly();
