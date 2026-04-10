import { IMPORT_ENTITY_TYPES, IMPORT_SOURCES } from "@pluralscape/types";
import { z } from "zod/v4";

import {
  IMPORT_ENTITY_REF_BATCH_MAX,
  MAX_PLURALSCAPE_ENTITY_ID_LENGTH,
} from "./validation.constants.js";

/**
 * Maximum length of a source-side identifier stored in `import_entity_refs.source_entity_id`.
 * Matches the PG varchar(128) constraint defined in the schema.
 */
const MAX_SOURCE_ENTITY_ID_LENGTH = 128;

export const ImportEntityRefQuerySchema = z
  .object({
    source: z.enum(IMPORT_SOURCES).optional(),
    entityType: z.enum(IMPORT_ENTITY_TYPES).optional(),
    sourceEntityId: z.string().min(1).max(MAX_SOURCE_ENTITY_ID_LENGTH).optional(),
  })
  .readonly();

/**
 * Body schema for batch lookup of import entity refs by source entity IDs.
 *
 * Returns a map of `sourceEntityId → pluralscapeEntityId`. Used by importers
 * to skip already-imported entities in bulk and to resolve cross-entity
 * references (e.g. fronting sessions referencing members).
 */
export const ImportEntityRefLookupBatchBodySchema = z
  .object({
    source: z.enum(IMPORT_SOURCES),
    sourceEntityType: z.enum(IMPORT_ENTITY_TYPES),
    sourceEntityIds: z
      .array(z.string().min(1).max(MAX_SOURCE_ENTITY_ID_LENGTH))
      .min(1)
      .max(IMPORT_ENTITY_REF_BATCH_MAX),
  })
  .readonly();

/**
 * Body schema for batch upsert of import entity refs.
 *
 * Each entry maps a source-side entity to its newly-created Pluralscape entity.
 * Idempotent: re-running with the same payload updates the `pluralscape_entity_id`
 * on conflict via the unique constraint
 * `(account_id, system_id, source, source_entity_type, source_entity_id)`.
 */
export const ImportEntityRefUpsertBatchBodySchema = z
  .object({
    source: z.enum(IMPORT_SOURCES),
    entries: z
      .array(
        z.object({
          sourceEntityType: z.enum(IMPORT_ENTITY_TYPES),
          sourceEntityId: z.string().min(1).max(MAX_SOURCE_ENTITY_ID_LENGTH),
          pluralscapeEntityId: z.string().min(1).max(MAX_PLURALSCAPE_ENTITY_ID_LENGTH),
        }),
      )
      .min(1)
      .max(IMPORT_ENTITY_REF_BATCH_MAX),
  })
  .readonly();

export type ImportEntityRefLookupBatchBody = z.infer<typeof ImportEntityRefLookupBatchBodySchema>;
export type ImportEntityRefUpsertBatchBody = z.infer<typeof ImportEntityRefUpsertBatchBodySchema>;
