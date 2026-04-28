import { getMaterializer } from "@pluralscape/sync/materializer";

import type { DocumentSnapshotProvider } from "./crdt-query-bridge.js";
import type { DataLayerEventMap, EventBus, SyncedEntityType } from "@pluralscape/sync";
import type { MaterializerDb } from "@pluralscape/sync/materializer";
import type { SyncDocumentId, SyncDocumentType } from "@pluralscape/types";

export interface MaterializerSubscriberDeps {
  /** Source of CRDT document snapshots. SyncEngine implements this interface. */
  readonly engine: DocumentSnapshotProvider;
  /** Adapter over the local SQLite database where materialized rows are written. */
  readonly materializerDb: MaterializerDb;
  /** Event bus carrying sync:changes-merged and sync:snapshot-applied. */
  readonly eventBus: EventBus<DataLayerEventMap>;
}

export interface MaterializerSubscriberHandle {
  /** Unsubscribes both listeners. Idempotent. */
  readonly dispose: () => void;
}

function isRecordSnapshot(doc: unknown): doc is Record<string, unknown> {
  return doc !== null && typeof doc === "object";
}

/**
 * Subscribes to engine merge events and runs the registered materializer
 * for the affected document. On `sync:changes-merged`, materializes only
 * the dirty entity types (perf gain landed in sync-f4ma). On
 * `sync:snapshot-applied`, full materialisation (no dirty filter — fresh
 * snapshot replaces the doc).
 *
 * Materialization runs synchronously inside the event-bus dispatch.
 * After completion, the materializer emits `materialized:document` and
 * `search:index-updated` itself — no double-emit needed here.
 *
 * Skips silently when the engine has evicted the session (snapshot is
 * undefined) or no materializer is registered for the document type.
 */
export function createMaterializerSubscriber(
  deps: MaterializerSubscriberDeps,
): MaterializerSubscriberHandle {
  const { engine, materializerDb, eventBus } = deps;

  function materialise(
    documentId: SyncDocumentId,
    documentType: SyncDocumentType,
    dirty: ReadonlySet<SyncedEntityType> | undefined,
  ): void {
    const doc = engine.getDocumentSnapshot(documentId);
    if (!isRecordSnapshot(doc)) return;

    const materializer = getMaterializer(documentType);
    if (!materializer) return;

    materializer.materialize(doc, materializerDb, eventBus, dirty);
  }

  const offMerged = eventBus.on("sync:changes-merged", (event) => {
    materialise(event.documentId as SyncDocumentId, event.documentType, event.dirtyEntityTypes);
  });

  const offSnapshot = eventBus.on("sync:snapshot-applied", (event) => {
    materialise(event.documentId as SyncDocumentId, event.documentType, undefined);
  });

  return {
    dispose() {
      offMerged();
      offSnapshot();
    },
  };
}
