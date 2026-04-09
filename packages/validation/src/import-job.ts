import {
  IMPORT_AVATAR_MODES,
  IMPORT_CHECKPOINT_SCHEMA_VERSION,
  IMPORT_COLLECTION_TYPES,
  IMPORT_ENTITY_TYPES,
  IMPORT_JOB_STATUSES,
  IMPORT_SOURCES,
  type ImportError,
} from "@pluralscape/types";
import { z } from "zod/v4";

const PROGRESS_PERCENT_MIN = 0;
const PROGRESS_PERCENT_MAX = 100;

const ImportErrorBaseShape = {
  entityType: z.enum(IMPORT_ENTITY_TYPES),
  entityId: z.string().nullable(),
  message: z.string().min(1),
};

export const ImportErrorSchema = z.discriminatedUnion("fatal", [
  z
    .object({
      ...ImportErrorBaseShape,
      fatal: z.literal(false),
    })
    .readonly(),
  z
    .object({
      ...ImportErrorBaseShape,
      fatal: z.literal(true),
      recoverable: z.boolean(),
    })
    .readonly(),
]);

const ImportCollectionTotalsSchema = z
  .object({
    total: z.number().int().nonnegative(),
    imported: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  })
  .readonly();

export const ImportCheckpointStateSchema = z
  .object({
    schemaVersion: z.literal(IMPORT_CHECKPOINT_SCHEMA_VERSION),
    checkpoint: z
      .object({
        completedCollections: z.array(z.enum(IMPORT_COLLECTION_TYPES)).readonly(),
        currentCollection: z.enum(IMPORT_COLLECTION_TYPES),
        currentCollectionLastSourceId: z.string().nullable(),
      })
      .readonly(),
    options: z
      .object({
        selectedCategories: z.record(z.enum(IMPORT_COLLECTION_TYPES), z.boolean().optional()),
        avatarMode: z.enum(IMPORT_AVATAR_MODES),
      })
      .readonly(),
    totals: z
      .object({
        perCollection: z.record(
          z.enum(IMPORT_COLLECTION_TYPES),
          ImportCollectionTotalsSchema.optional(),
        ),
      })
      .readonly(),
  })
  .readonly();

export const CreateImportJobBodySchema = z
  .object({
    source: z.enum(IMPORT_SOURCES),
    selectedCategories: z.record(z.enum(IMPORT_COLLECTION_TYPES), z.boolean().optional()),
    avatarMode: z.enum(IMPORT_AVATAR_MODES),
  })
  .readonly()
  .refine((value) => Object.values(value.selectedCategories).some((v) => v), {
    message: "At least one category must be selected",
    path: ["selectedCategories"],
  });

export const UpdateImportJobBodySchema = z
  .object({
    status: z.enum(IMPORT_JOB_STATUSES).optional(),
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
    status: z.enum(IMPORT_JOB_STATUSES).optional(),
    source: z.enum(IMPORT_SOURCES).optional(),
  })
  .readonly();

// ── Compile-time parity guards ──────────────────────────────────────
// These functions do nothing at runtime. Any drift between the Zod
// schemas and the TypeScript domain types will fail typecheck here.

const _importErrorParity: (x: z.infer<typeof ImportErrorSchema>) => ImportError = (x) => x;
const _importErrorParityReverse: (x: ImportError) => z.infer<typeof ImportErrorSchema> = (x) => x;

void _importErrorParity;
void _importErrorParityReverse;
