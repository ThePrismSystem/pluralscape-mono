import { materializeDocument } from "./materializers/materialize-document.js";

import type { SyncDocumentType } from "../document-types.js";
import type { MaterializerDb } from "./base-materializer.js";
import type { EventBus, DataLayerEventMap } from "../event-bus/index.js";

/**
 * A materializer that knows how to extract entities from an Automerge document
 * of a specific type and write them to the local SQLite database.
 */
export interface DocumentMaterializer {
  readonly documentType: SyncDocumentType;

  /**
   * Materialize all entity types from the given Automerge document into SQLite.
   *
   * Emits `materialized:document` and `search:index-updated` events when done.
   */
  materialize(
    doc: Record<string, unknown>,
    db: MaterializerDb,
    eventBus: EventBus<DataLayerEventMap>,
  ): void;
}

const registry = new Map<SyncDocumentType, DocumentMaterializer>();

/** Register a materializer for a specific document type. */
export function registerMaterializer(m: DocumentMaterializer): void {
  registry.set(m.documentType, m);
}

/** Look up the materializer for a specific document type. */
export function getMaterializer(dt: SyncDocumentType): DocumentMaterializer | undefined {
  return registry.get(dt);
}

/**
 * Creates a DocumentMaterializer that delegates to the shared
 * materializeDocument function.
 */
export function createMaterializer(documentType: SyncDocumentType): DocumentMaterializer {
  return {
    documentType,
    materialize(
      doc: Record<string, unknown>,
      db: MaterializerDb,
      eventBus: EventBus<DataLayerEventMap>,
    ): void {
      materializeDocument(documentType, doc, db, eventBus);
    },
  };
}
