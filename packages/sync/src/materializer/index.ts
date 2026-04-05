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

export {
  getTableDef,
  getEntityTypesForDocument,
  ENTITY_TABLE_REGISTRY,
  FRIEND_EXPORTABLE_ENTITY_TYPES,
  type ColumnDef,
  type EntityTableDef,
} from "./entity-registry.js";

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
  "privacy-config",
];
for (const docType of DOCUMENT_TYPES) {
  registerMaterializer(createMaterializer(docType));
}
