import { z } from "zod/v4";

const IMPORT_SOURCE_VALUES = ["simply-plural", "pluralkit", "pluralscape"] as const;

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

/**
 * Maximum length of a source-side identifier stored in `import_entity_refs.source_ref_id`.
 * Matches the PG varchar(256) constraint defined in the schema.
 */
const MAX_SOURCE_ENTITY_ID_LENGTH = 256;

export const ImportEntityRefQuerySchema = z
  .object({
    importJobId: z.string().min(1).optional(),
    source: z.enum(IMPORT_SOURCE_VALUES).optional(),
    entityType: z.enum(IMPORT_ENTITY_TYPE_VALUES).optional(),
    sourceEntityId: z.string().min(1).max(MAX_SOURCE_ENTITY_ID_LENGTH).optional(),
  })
  .readonly();
