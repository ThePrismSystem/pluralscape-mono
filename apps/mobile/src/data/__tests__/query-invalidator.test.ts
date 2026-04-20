import { createEventBus } from "@pluralscape/sync";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createQueryInvalidator } from "../query-invalidator.js";

import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";
import type { InvalidateQueryFilters, QueryKey } from "@tanstack/react-query";

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Narrow stand-in for `QueryClient.invalidateQueries`. The bridge under
 * test only ever calls the overload `(filters?) => Promise<void>`, so we
 * type the mock with that signature and re-bind the client method to it.
 */
type InvalidateFn = (filters?: InvalidateQueryFilters) => Promise<void>;

/** Predicate callback shape used inside the filter under test. */
type QueryForPredicate = { readonly queryKey: QueryKey };
type FilterPredicate = (query: QueryForPredicate) => boolean;

/** Strongly-typed view of a filter that carries a predicate. */
interface FilterWithPredicate extends InvalidateQueryFilters {
  readonly predicate: FilterPredicate;
}

function hasPredicate(filters: InvalidateQueryFilters): filters is FilterWithPredicate {
  return typeof filters.predicate === "function";
}

function makeEventBus(): EventBus<DataLayerEventMap> {
  return createEventBus<DataLayerEventMap>();
}

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createInvalidateSpy(): Mock<InvalidateFn> {
  return vi.fn<InvalidateFn>(() => Promise.resolve());
}

/**
 * Rebinds `queryClient.invalidateQueries` to the spy so every call routes
 * through a typed mock. This bypasses the overload soup of `vi.spyOn` while
 * keeping strict typing (no `any`, no double-cast).
 */
function installInvalidateSpy(queryClient: QueryClient, spy: Mock<InvalidateFn>): void {
  Object.defineProperty(queryClient, "invalidateQueries", {
    configurable: true,
    writable: true,
    value: spy,
  });
}

function filterAt(spy: Mock<InvalidateFn>, callIndex: number): InvalidateQueryFilters {
  const call = spy.mock.calls[callIndex];
  if (call === undefined) throw new Error(`no invalidate call at index ${String(callIndex)}`);
  const [filters] = call;
  if (filters === undefined) throw new Error(`call ${String(callIndex)} had no filter argument`);
  return filters;
}

function requirePredicate(filters: InvalidateQueryFilters): FilterPredicate {
  if (!hasPredicate(filters)) throw new Error("expected filters.predicate to be defined");
  return filters.predicate;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("createQueryInvalidator", () => {
  let eventBus: EventBus<DataLayerEventMap>;
  let queryClient: QueryClient;
  let invalidateQueries: Mock<InvalidateFn>;

  beforeEach(() => {
    eventBus = makeEventBus();
    queryClient = makeQueryClient();
    invalidateQueries = createInvalidateSpy();
    installInvalidateSpy(queryClient, invalidateQueries);
  });

  it("returns a cleanup function", () => {
    const cleanup = createQueryInvalidator(eventBus, queryClient);
    expect(typeof cleanup).toBe("function");
  });

  describe("materialized:document (non-hotPath tables — broad fallback)", () => {
    it("invalidates the full table key for non-hotPath entity types", () => {
      createQueryInvalidator(eventBus, queryClient);

      // `system-core` contains member/group/system/buckets — all hotPath: false.
      eventBus.emit("materialized:document", {
        type: "materialized:document",
        documentType: "system-core",
      });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["members"] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["groups"] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["system"] });

      // None of the non-hotPath calls carry a predicate (broad fallback).
      for (const [i] of invalidateQueries.mock.calls.entries()) {
        const filters = filterAt(invalidateQueries, i);
        expect(filters.predicate).toBeUndefined();
      }
    });
  });

  describe("materialized:document (hotPath tables — narrowed to lists)", () => {
    it("narrows invalidation to list-style queries for hotPath entity types", () => {
      createQueryInvalidator(eventBus, queryClient);

      // `fronting` document: every entity type is hotPath: true
      // (fronting-session, fronting-comment, fronting-message, ...).
      eventBus.emit("materialized:document", {
        type: "materialized:document",
        documentType: "fronting",
      });

      expect(invalidateQueries).toHaveBeenCalled();

      // Every hotPath call carries the list-only predicate.
      for (const [i] of invalidateQueries.mock.calls.entries()) {
        const filters = filterAt(invalidateQueries, i);
        expect(hasPredicate(filters)).toBe(true);
      }
    });

    it("predicate matches list queries and rejects detail queries on the same table", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("materialized:document", {
        type: "materialized:document",
        documentType: "fronting",
      });

      // Find the call for `fronting_sessions` — fronting-session is hotPath.
      const sessionsIndex = invalidateQueries.mock.calls.findIndex((call) => {
        const [filters] = call;
        if (filters === undefined) return false;
        const key = filters.queryKey;
        return Array.isArray(key) && key[0] === "fronting_sessions";
      });
      expect(sessionsIndex).toBeGreaterThanOrEqual(0);

      const predicate = requirePredicate(filterAt(invalidateQueries, sessionsIndex));

      // The predicate is AND-composed with the `queryKey` prefix filter by
      // React Query — it only runs for queries whose key starts with
      // `[tableName]`. It therefore only needs to distinguish list queries
      // from detail queries within the table.
      //
      // List query → matches.
      expect(predicate({ queryKey: ["fronting_sessions", "list"] })).toBe(true);
      expect(predicate({ queryKey: ["fronting_sessions", "list", true, "member-1"] })).toBe(true);
      // Detail query → does NOT match (entity events cover these).
      expect(predicate({ queryKey: ["fronting_sessions", "fs-1"] })).toBe(false);
    });
  });

  describe("materialized:entity", () => {
    it("invalidates the specific entity by table name and id", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("materialized:entity", {
        type: "materialized:entity",
        documentType: "fronting",
        entityType: "fronting-session",
        entityId: "fs-1",
        op: "update",
      });

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["fronting_sessions", "fs-1"],
      });
    });

    it("uses the correct table name for different entity types", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("materialized:entity", {
        type: "materialized:entity",
        documentType: "system-core",
        entityType: "member",
        entityId: "m-42",
        op: "create",
      });

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["members", "m-42"],
      });
    });
  });

  describe("search:index-updated", () => {
    it("invalidates the search key with a scope-filtering predicate", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("search:index-updated", {
        type: "search:index-updated",
        scope: "self",
      });

      expect(invalidateQueries).toHaveBeenCalledTimes(1);
      const filters = filterAt(invalidateQueries, 0);
      expect(filters.queryKey).toEqual(["search"]);
      expect(hasPredicate(filters)).toBe(true);
    });

    it("predicate matches only queries with matching scope", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("search:index-updated", {
        type: "search:index-updated",
        scope: "self",
      });

      const predicate = requirePredicate(filterAt(invalidateQueries, 0));

      // Matching scope → invalidated.
      expect(predicate({ queryKey: ["search", "hello", "self"] })).toBe(true);
      expect(predicate({ queryKey: ["search", "", "self"] })).toBe(true);
      // Other scope → preserved.
      expect(predicate({ queryKey: ["search", "hello", "friend"] })).toBe(false);
      // Key shape without scope slot → preserved.
      expect(predicate({ queryKey: ["search"] })).toBe(false);
    });

    it("a friend-scope event does not invalidate self-scope queries", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("search:index-updated", {
        type: "search:index-updated",
        scope: "friend",
        documentType: "system-core",
      });

      const predicate = requirePredicate(filterAt(invalidateQueries, 0));

      expect(predicate({ queryKey: ["search", "q", "friend"] })).toBe(true);
      expect(predicate({ queryKey: ["search", "q", "self"] })).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("unsubscribes all listeners when cleanup is called", () => {
      const cleanup = createQueryInvalidator(eventBus, queryClient);
      cleanup();

      eventBus.emit("materialized:document", {
        type: "materialized:document",
        documentType: "system-core",
      });
      eventBus.emit("materialized:entity", {
        type: "materialized:entity",
        documentType: "fronting",
        entityType: "fronting-session",
        entityId: "fs-1",
        op: "delete",
      });
      eventBus.emit("search:index-updated", {
        type: "search:index-updated",
        scope: "self",
      });

      expect(invalidateQueries).not.toHaveBeenCalled();
    });
  });
});
