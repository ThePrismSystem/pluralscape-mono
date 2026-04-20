import { getEntityTypesForDocument, getTableDef } from "@pluralscape/sync/materializer";

import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Index into a React Query key at which list-style queries carry the
 * `"list"` discriminator. See `src/hooks/use-*.ts` — all list hooks shape
 * keys as `[tableName, "list", ...]` and detail hooks shape keys as
 * `[tableName, entityId]`.
 */
const LIST_DISCRIMINATOR_INDEX = 1;

function isListQuery(queryKey: QueryKey): boolean {
  return queryKey[LIST_DISCRIMINATOR_INDEX] === "list";
}

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
      const tableDef = getTableDef(entityType);
      // Narrowing: for hot-path entity types, per-entity `materialized:entity`
      // events (see `unsubEntity` below) already precisely invalidate detail
      // queries (`[tableName, entityId]`). The document-level event only
      // needs to cover list queries (`[tableName, "list", ...]`).
      //
      // For non-hot-path entity types no entity-level events fire, so the
      // document event must broadly invalidate `[tableName]` to keep both
      // list and detail queries in sync.
      if (tableDef.hotPath) {
        void queryClient.invalidateQueries({
          queryKey: [tableDef.tableName],
          predicate: (query) => isListQuery(query.queryKey),
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: [tableDef.tableName] });
      }
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
