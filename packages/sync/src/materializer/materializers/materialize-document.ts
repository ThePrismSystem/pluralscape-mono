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
 * 2. Queries current SQLite state (skipped when entity type is clean)
 * 3. Diffs and applies changes
 *
 * The optional `dirtyEntityTypes` set, when provided, narrows materialisation
 * to only those entity types whose CRDT fields were touched by the incoming
 * change. Clean types are skipped entirely — no SQL is issued for them. When
 * omitted, all entity types for the document are scanned (legacy behaviour).
 *
 * After all entity types are processed, emits `materialized:document`
 * and `search:index-updated` events.
 */
export function materializeDocument(
  documentType: SyncDocumentType,
  doc: Record<string, unknown>,
  db: MaterializerDb,
  eventBus: EventBus<DataLayerEventMap>,
  dirtyEntityTypes?: ReadonlySet<string>,
): void {
  const entityTypes = getEntityTypesForDocument(documentType);

  for (const entityType of entityTypes) {
    // Skip entity types whose CRDT fields were not touched by this change.
    if (dirtyEntityTypes !== undefined && !dirtyEntityTypes.has(entityType)) continue;

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
