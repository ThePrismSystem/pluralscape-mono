import { createEventBus } from "@pluralscape/sync";
import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryInvalidator } from "../query-invalidator.js";

import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";

// ── Helpers ───────────────────────────────────────────────────────────

function makeEventBus(): EventBus<DataLayerEventMap> {
  return createEventBus<DataLayerEventMap>();
}

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("createQueryInvalidator", () => {
  let eventBus: EventBus<DataLayerEventMap>;
  let queryClient: QueryClient;
  let invalidateQueries: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    eventBus = makeEventBus();
    queryClient = makeQueryClient();
    invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  });

  it("returns a cleanup function", () => {
    const cleanup = createQueryInvalidator(eventBus, queryClient);
    expect(typeof cleanup).toBe("function");
  });

  describe("materialized:document", () => {
    it("invalidates all entity table keys for a document type", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("materialized:document", {
        type: "materialized:document",
        documentType: "system-core",
      });

      // system-core entities include member → "members", group → "groups",
      // system → "system", among others. Each gets a table-level invalidation.
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["members"] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["groups"] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["system"] });
    });

    it("does not invalidate with entity-level key on document event", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("materialized:document", {
        type: "materialized:document",
        documentType: "fronting",
      });

      // All calls should be table-level only (single-element queryKey arrays)
      expect(invalidateQueries).toHaveBeenCalled();
      for (const call of invalidateQueries.mock.calls) {
        const arg = call[0] as { queryKey: unknown[] };
        expect(arg.queryKey).toHaveLength(1);
      }
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
    it("invalidates the search query key", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("search:index-updated", {
        type: "search:index-updated",
        scope: "self",
      });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["search"] });
    });

    it("invalidates search regardless of scope", () => {
      createQueryInvalidator(eventBus, queryClient);

      eventBus.emit("search:index-updated", {
        type: "search:index-updated",
        scope: "friend",
        documentType: "system-core",
      });

      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["search"] });
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
