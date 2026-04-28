import { ENTITY_CRDT_STRATEGIES } from "../../strategies/crdt-strategies.js";
import {
  diffEntities,
  applyDiff,
  type MaterializerDb,
  type EntityRow,
} from "../base-materializer.js";
import { getTableMetadataForEntityType } from "../drizzle-bridge.js";
import { ENTITY_METADATA } from "../entity-metadata.js";

import { extractEntities } from "./extract-entities.js";

import type { SyncDocumentType } from "../../document-types.js";
import type { EventBus, DataLayerEventMap } from "../../event-bus/index.js";
import type { SyncedEntityType } from "../../strategies/crdt-strategies.js";

function getEntityTypesForDocument(documentType: SyncDocumentType): SyncedEntityType[] {
  return (Object.keys(ENTITY_CRDT_STRATEGIES) as SyncedEntityType[]).filter(
    (entityType) => ENTITY_CRDT_STRATEGIES[entityType].document === documentType,
  );
}

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
 * omitted, every entity type for the document is scanned (default — no dirty
 * filter).
 *
 * After all entity types are processed, emits `materialized:document`
 * and `search:index-updated` events.
 */
export function materializeDocument(
  documentType: SyncDocumentType,
  doc: Record<string, unknown>,
  db: MaterializerDb,
  eventBus: EventBus<DataLayerEventMap>,
  dirtyEntityTypes?: ReadonlySet<SyncedEntityType>,
): void {
  const entityTypes = getEntityTypesForDocument(documentType);

  for (const entityType of entityTypes) {
    if (dirtyEntityTypes !== undefined && !dirtyEntityTypes.has(entityType)) continue;

    const incoming = extractEntities(entityType, doc);
    if (incoming.length === 0) continue;

    const meta = getTableMetadataForEntityType(entityType);
    const current = db.queryAll<EntityRow>(`SELECT * FROM ${meta.tableName}`, []);
    const diff = diffEntities(current, incoming);
    applyDiff(
      db,
      meta,
      entityType,
      documentType,
      diff,
      eventBus,
      ENTITY_METADATA[entityType].hotPath,
    );
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
