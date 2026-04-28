import { createMaterializer, registerMaterializer } from "./materializer-registry.js";

import type { SyncDocumentType } from "../document-types.js";

// ── Core materializer infrastructure ────────────────────────────────
export {
  diffEntities,
  applyDiff,
  entityToRow,
  toSnakeCase,
  type EntityRow,
  type DiffResult,
  type MaterializerDb,
} from "./base-materializer.js";

export { getTableMetadataForEntityType, type MaterializerTableMetadata } from "./drizzle-bridge.js";

export {
  ENTITY_METADATA,
  FRIEND_EXPORTABLE_ENTITY_TYPES,
  type EntityMetadata,
} from "./entity-metadata.js";

export { generateSchemaStatements, generateFtsStatements, generateAllDdl } from "./local-schema.js";

export {
  registerMaterializer,
  getMaterializer,
  createMaterializer,
  type DocumentMaterializer,
} from "./materializer-registry.js";

export { extractEntities } from "./materializers/extract-entities.js";
export { materializeDocument } from "./materializers/materialize-document.js";

// ── Auto-register all materializers on import ───────────────────────
const DOCUMENT_TYPES: SyncDocumentType[] = [
  "system-core",
  "fronting",
  "chat",
  "journal",
  "note",
  "privacy-config",
  "bucket",
];
for (const docType of DOCUMENT_TYPES) {
  registerMaterializer(createMaterializer(docType));
}
