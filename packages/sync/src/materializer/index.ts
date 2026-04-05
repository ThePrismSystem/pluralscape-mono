import { registerMaterializer } from "./materializer-registry.js";
import { chatMaterializer } from "./materializers/chat.js";
import { frontingMaterializer } from "./materializers/fronting.js";
import { journalMaterializer } from "./materializers/journal.js";
import { privacyConfigMaterializer } from "./materializers/privacy-config.js";
import { systemCoreMaterializer } from "./materializers/system-core.js";

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
  type ColumnDef,
  type EntityTableDef,
} from "./entity-registry.js";

export { generateSchemaStatements, generateFtsStatements, generateAllDdl } from "./local-schema.js";

export {
  registerMaterializer,
  getMaterializer,
  type DocumentMaterializer,
} from "./materializer-registry.js";

export { extractEntities } from "./materializers/extract-entities.js";
export { materializeDocument } from "./materializers/materialize-document.js";

// ── Document materializers ──────────────────────────────────────────
export { systemCoreMaterializer } from "./materializers/system-core.js";
export { frontingMaterializer } from "./materializers/fronting.js";
export { chatMaterializer } from "./materializers/chat.js";
export { journalMaterializer } from "./materializers/journal.js";
export { privacyConfigMaterializer } from "./materializers/privacy-config.js";

// ── Auto-register all materializers on import ───────────────────────
registerMaterializer(systemCoreMaterializer);
registerMaterializer(frontingMaterializer);
registerMaterializer(chatMaterializer);
registerMaterializer(journalMaterializer);
registerMaterializer(privacyConfigMaterializer);
