import { getEntityTypesForDocument, getTableDef } from "@pluralscape/sync/materializer";

import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Bridges the sync/materialization event bus to React Query invalidations.
 *
 * Subscribes to materialization and search events from the event bus and calls
 * `queryClient.invalidateQueries` so the UI refetches stale data automatically.
 *
 * @returns A cleanup function that unsubscribes all listeners.
 */
export function createQueryInvalidator(
  eventBus: EventBus<DataLayerEventMap>,
  queryClient: QueryClient,
): () => void {
  const unsubDocument = eventBus.on("materialized:document", (event) => {
    const entityTypes = getEntityTypesForDocument(event.documentType);
    for (const entityType of entityTypes) {
      const { tableName } = getTableDef(entityType);
      void queryClient.invalidateQueries({ queryKey: [tableName] });
    }
  });

  const unsubEntity = eventBus.on("materialized:entity", (event) => {
    const { tableName } = getTableDef(event.entityType);
    void queryClient.invalidateQueries({ queryKey: [tableName, event.entityId] });
  });

  const unsubSearch = eventBus.on("search:index-updated", () => {
    void queryClient.invalidateQueries({ queryKey: ["search"] });
  });

  return () => {
    unsubDocument();
    unsubEntity();
    unsubSearch();
  };
}
