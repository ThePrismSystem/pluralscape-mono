import { getEntityTypesForDocument, getTableDef } from "@pluralscape/sync/materializer";

import type {
  DataLayerEventMap,
  EventBus,
  SearchScope as EventSearchScope,
} from "@pluralscape/sync";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Index into a React Query key at which list-style queries carry the
 * `"list"` discriminator. See `src/hooks/use-*.ts` — all list hooks shape
 * keys as `[tableName, "list", ...]` and detail hooks shape keys as
 * `[tableName, entityId]`.
 */
const LIST_DISCRIMINATOR_INDEX = 1;

/**
 * Index into a search query key at which the scope
 * (`"self" | "friends" | "all"`) appears. Search keys are shaped
 * `["search", debouncedQuery, scope]` (see `src/hooks/use-search.ts`).
 */
const SEARCH_SCOPE_INDEX = 2;

/**
 * Maps an event's search scope (the data source that materialized) to the
 * set of UI-side query scopes that must be invalidated.
 *
 * Event scope union: `"self" | "friend"` (see `@pluralscape/sync` event map).
 * Query scope union: `"self" | "friends" | "all"` (see `use-search.ts`).
 *
 * A self-materialization invalidates both `"self"`-only and `"all"`-scope
 * searches; a friend-materialization invalidates both `"friends"`-only and
 * `"all"`-scope searches. The `"all"` default is critical — it's what
 * `useSearch()` uses when no scope is passed explicitly.
 */
function queryScopesToInvalidate(scope: EventSearchScope): ReadonlySet<string> {
  switch (scope) {
    case "self":
      return new Set(["self", "all"]);
    case "friend":
      return new Set(["friends", "all"]);
  }
}

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
      // Narrowing: for hot-path entity types whose detail keys are shaped
      // `[tableName, entityId]`, per-entity `materialized:entity` events
      // (see `unsubEntity` below) already precisely invalidate those detail
      // queries. The document-level event only needs to cover list queries
      // (`[tableName, "list", ...]`).
      //
      // For non-hot-path entity types no entity-level events fire, and for
      // hot-path entity types with compound detail keys (e.g., `messages`
      // uses `[tableName, channelId, entityId]`) the list-only predicate
      // would skip details that the entity-event prefix match also misses.
      // In both cases the document event must broadly invalidate
      // `[tableName]` so details stay fresh.
      const canNarrowToLists = tableDef.hotPath && tableDef.compoundDetailKey !== true;
      if (canNarrowToLists) {
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

  const unsubSearch = eventBus.on("search:index-updated", (event) => {
    // Search queries are keyed `["search", debouncedQuery, scope]` where the
    // UI-side scope union is `"self" | "friends" | "all"` (see
    // `use-search.ts`). The event's scope is the data-source that
    // materialized (`"self" | "friend"`). Map through
    // `queryScopesToInvalidate` so an "all"-scope default search is not
    // left stale after either kind of event. Queries without a string
    // scope slot fall through and stay cached.
    const targetScopes = queryScopesToInvalidate(event.scope);
    void queryClient.invalidateQueries({
      queryKey: ["search"],
      predicate: (query) => {
        const scopeSlot = query.queryKey[SEARCH_SCOPE_INDEX];
        return typeof scopeSlot === "string" && targetScopes.has(scopeSlot);
      },
    });
  });

  return () => {
    unsubDocument();
    unsubEntity();
    unsubSearch();
  };
}
