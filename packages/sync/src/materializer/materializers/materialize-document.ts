import {
  diffEntities,
  applyDiff,
  type MaterializerDb,
  type EntityRow,
} from "../base-materializer.js";
import { getTableDef, getEntityTypesForDocument } from "../entity-registry.js";

import { extractEntities } from "./extract-entities.js";

import type { SyncDocumentType } from "../../document-types.js";
import type { EventBus, DataLayerEventMap } from "../../event-bus/index.js";

/**
 * Shared materialization logic for all document types.
 *
 * For each entity type belonging to the document:
 * 1. Extracts incoming entities from the Automerge doc
 * 2. Queries current SQLite state
 * 3. Diffs and applies changes
 *
 * After all entity types are processed, emits `materialized:document`
 * and `search:index-updated` events.
 */
export function materializeDocument(
  documentType: SyncDocumentType,
  doc: Record<string, unknown>,
  db: MaterializerDb,
  eventBus: EventBus<DataLayerEventMap>,
): void {
  const entityTypes = getEntityTypesForDocument(documentType);

  for (const entityType of entityTypes) {
    const incoming = extractEntities(entityType, doc);

    // Skip entity types with no incoming data — avoids full-table scan
    // when the document contains no entities of this type.
    if (incoming.length === 0) continue;

    const tableDef = getTableDef(entityType);
    const current = db.queryAll<EntityRow>(`SELECT * FROM ${tableDef.tableName}`, []);
    const diff = diffEntities(current, incoming);
    applyDiff(db, tableDef, entityType, documentType, diff, eventBus);
  }

  eventBus.emit("materialized:document", {
    type: "materialized:document",
    documentType,
  });

  eventBus.emit("search:index-updated", {
    type: "search:index-updated",
    scope: "self",
    documentType,
  });
}
