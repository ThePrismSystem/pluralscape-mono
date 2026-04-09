import { IMPORT_ENTITY_TYPES, IMPORT_SOURCES } from "@pluralscape/types";
import { z } from "zod/v4";

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
