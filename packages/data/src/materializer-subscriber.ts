import { NoActiveSessionError } from "@pluralscape/sync";
import { getMaterializer } from "@pluralscape/sync/materializer";

import type { DocumentSnapshotProvider } from "./crdt-query-bridge.js";
import type { DataLayerEventMap, EventBus, SyncedEntityType } from "@pluralscape/sync";
import type { MaterializerDb } from "@pluralscape/sync/materializer";
import type { SyncDocumentId, SyncDocumentType } from "@pluralscape/types";

export interface MaterializerSubscriberDeps {
  readonly engine: DocumentSnapshotProvider;
  readonly materializerDb: MaterializerDb;
  readonly eventBus: EventBus<DataLayerEventMap>;
}

export interface MaterializerSubscriberHandle {
  /** Unsubscribes both listeners. Idempotent. */
  readonly dispose: () => void;
}

/**
 * Subscribes to engine merge events and runs the registered materializer
 * for the affected document. On `sync:changes-merged`, materializes only
 * the dirty entity types. On `sync:snapshot-applied`, full materialisation
 * (no dirty filter — fresh snapshot replaces the doc).
 *
 * Materialisation runs synchronously inside the event-bus dispatch and is
 * wrapped in a single `materializerDb.transaction(...)` so all entity-type
 * passes for one merge land atomically — readers never observe a half-merged
 * state. After completion, the materializer emits `materialized:document`
 * and `search:index-updated` itself.
 *
 * Failure modes are surfaced through the event bus rather than thrown:
 *
 * - `NoActiveSessionError` from `engine.getDocumentSnapshot` is treated as a
 *   benign race (session evicted before the listener fired) and skipped.
 * - Any other snapshot read error or materializer write error is reported
 *   via `sync:error` so observers can react; the listener does not crash
 *   the bus dispatch (which would queueMicrotask the throw into an
 *   unhandled rejection).
 *
 * Skips silently when no materializer is registered for the document type.
 */
export function createMaterializerSubscriber(
  deps: MaterializerSubscriberDeps,
): MaterializerSubscriberHandle {
  const { engine, materializerDb, eventBus } = deps;

  function materialize(
    documentId: SyncDocumentId,
    documentType: SyncDocumentType,
    dirty: ReadonlySet<SyncedEntityType> | undefined,
  ): void {
    let doc: unknown;
    try {
      doc = engine.getDocumentSnapshot(documentId);
    } catch (err) {
      if (err instanceof NoActiveSessionError) return;
      eventBus.emit("sync:error", {
        type: "sync:error",
        message: "materializer snapshot read failed",
        error: err,
      });
      return;
    }

    if (doc === null || typeof doc !== "object") return;
    const snapshot = doc as Record<string, unknown>;

    const materializer = getMaterializer(documentType);
    if (!materializer) return;

    try {
      materializerDb.transaction(() => {
        materializer.materialize(snapshot, materializerDb, eventBus, dirty);
      });
    } catch (err) {
      eventBus.emit("sync:error", {
        type: "sync:error",
        message: "materializer write failed",
        error: err,
      });
    }
  }

  const offMerged = eventBus.on("sync:changes-merged", (event) => {
    materialize(event.documentId, event.documentType, event.dirtyEntityTypes);
  });

  const offSnapshot = eventBus.on("sync:snapshot-applied", (event) => {
    materialize(event.documentId, event.documentType, undefined);
  });

  return {
    dispose() {
      offMerged();
      offSnapshot();
    },
  };
}
