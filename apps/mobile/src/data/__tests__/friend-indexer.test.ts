import { createEventBus } from "@pluralscape/sync";
import { ENTITY_TABLE_REGISTRY } from "@pluralscape/sync/materializer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFriendIndexer } from "../friend-indexer.js";

import type { FriendExportPage, FriendIndexerConfig } from "../friend-indexer.js";
import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";
import type { MaterializerDb } from "@pluralscape/sync/materializer";

// ── Helpers ───────────────────────────────────────────────────────────

function makeEventBus(): EventBus<DataLayerEventMap> {
  return createEventBus<DataLayerEventMap>();
}

function makeDb(): MaterializerDb {
  return {
    queryAll: vi.fn().mockReturnValue([]),
    execute: vi.fn(),
    transaction: vi.fn((fn: () => unknown) => fn()) as MaterializerDb["transaction"],
  };
}

function makeFetchExport(pages: FriendExportPage[]): FriendIndexerConfig["fetchExport"] {
  let call = 0;
  return vi.fn<FriendIndexerConfig["fetchExport"]>().mockImplementation(() => {
    const page = pages[call] ?? { data: [], hasMore: false };
    call++;
    return Promise.resolve(page);
  });
}

function makeDecryptEntity(): FriendIndexerConfig["decryptEntity"] {
  return vi
    .fn<FriendIndexerConfig["decryptEntity"]>()
    .mockImplementation((encryptedData: string) => {
      return { id: encryptedData, name: "Test" };
    });
}

/** Read mock.calls from the db.execute mock. */
function getExecuteCalls(db: MaterializerDb): [string, unknown[]][] {
  return vi.mocked(db).execute.mock.calls;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("createFriendIndexer", () => {
  let eventBus: EventBus<DataLayerEventMap>;
  let db: MaterializerDb;
  let fetchExport: FriendIndexerConfig["fetchExport"];
  let decryptEntity: FriendIndexerConfig["decryptEntity"];

  beforeEach(() => {
    eventBus = makeEventBus();
    db = makeDb();
    fetchExport = makeFetchExport([{ data: [], hasMore: false }]);
    decryptEntity = makeDecryptEntity();
  });

  it("returns a cleanup function", () => {
    const cleanup = createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });
    expect(typeof cleanup).toBe("function");
  });

  describe("ws:notification routing", () => {
    it("routes friend-updated notifications to friend:data-changed", async () => {
      const dataChangedListener = vi.fn();
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });
      eventBus.on("friend:data-changed", dataChangedListener);

      eventBus.emit("ws:notification", {
        type: "ws:notification",
        payload: { kind: "friend-updated", connectionId: "conn-1" },
      });

      // Allow microtask to propagate
      await Promise.resolve();
      expect(dataChangedListener).toHaveBeenCalledWith({
        type: "friend:data-changed",
        connectionId: "conn-1",
      });
    });

    it("ignores notifications with unknown kind", () => {
      const dataChangedListener = vi.fn();
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });
      eventBus.on("friend:data-changed", dataChangedListener);

      eventBus.emit("ws:notification", {
        type: "ws:notification",
        payload: { kind: "other-event", connectionId: "conn-1" },
      });

      expect(dataChangedListener).not.toHaveBeenCalled();
    });

    it("ignores notifications missing connectionId", () => {
      const dataChangedListener = vi.fn();
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });
      eventBus.on("friend:data-changed", dataChangedListener);

      eventBus.emit("ws:notification", {
        type: "ws:notification",
        payload: { kind: "friend-updated" },
      });

      expect(dataChangedListener).not.toHaveBeenCalled();
    });

    it("ignores non-object payloads", () => {
      const dataChangedListener = vi.fn();
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });
      eventBus.on("friend:data-changed", dataChangedListener);

      eventBus.emit("ws:notification", {
        type: "ws:notification",
        payload: null,
      });

      expect(dataChangedListener).not.toHaveBeenCalled();
    });
  });

  describe("friend:data-changed indexing", () => {
    it("fetches and indexes friend data on friend:data-changed event", async () => {
      fetchExport = vi.fn<FriendIndexerConfig["fetchExport"]>().mockResolvedValue({
        data: [{ id: "e-1", entityType: "member", encryptedData: "e-1", updatedAt: 1000 }],
        hasMore: false,
      });
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-abc",
      });

      await vi.waitFor(() => {
        expect(fetchExport).toHaveBeenCalledWith("conn-abc", undefined);
      });
    });

    it("deletes existing friend data before re-indexing (scoped by connection_id)", async () => {
      fetchExport = vi.fn<FriendIndexerConfig["fetchExport"]>().mockResolvedValue({
        data: [],
        hasMore: false,
      });
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-xyz",
      });

      await vi.waitFor(() => {
        const calls = getExecuteCalls(db);
        const deleteCalls = calls.filter((call) => call[0].includes("DELETE FROM"));
        expect(deleteCalls.length).toBeGreaterThan(0);
        for (const call of deleteCalls) {
          expect(call[0]).toMatch(/DELETE FROM friend_\w+ WHERE connection_id = \?/);
          expect(call[1]).toEqual(["conn-xyz"]);
        }
      });
    });

    it("deletes from all friend-exportable tables", async () => {
      fetchExport = vi.fn<FriendIndexerConfig["fetchExport"]>().mockResolvedValue({
        data: [],
        hasMore: false,
      });
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-xyz",
      });

      await vi.waitFor(() => {
        const executeCalls = getExecuteCalls(db);
        const deletedTables = executeCalls
          .filter((call) => call[0].includes("DELETE FROM"))
          .map((call) => {
            const match = /DELETE FROM (friend_\w+)/.exec(call[0]);
            return match?.[1];
          });

        expect(deletedTables).toContain(`friend_${ENTITY_TABLE_REGISTRY["member"].tableName}`);
        expect(deletedTables).toContain(
          `friend_${ENTITY_TABLE_REGISTRY["fronting-session"].tableName}`,
        );
        expect(deletedTables).toContain(
          `friend_${ENTITY_TABLE_REGISTRY["journal-entry"].tableName}`,
        );
      });
    });

    it("fetches all pages when hasMore is true", async () => {
      fetchExport = vi
        .fn<FriendIndexerConfig["fetchExport"]>()
        .mockResolvedValueOnce({
          data: [{ id: "e-1", entityType: "member", encryptedData: "e-1", updatedAt: 1000 }],
          hasMore: true,
          nextCursor: "cursor-2",
        })
        .mockResolvedValueOnce({
          data: [{ id: "e-2", entityType: "member", encryptedData: "e-2", updatedAt: 2000 }],
          hasMore: false,
        });

      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-1",
      });

      await vi.waitFor(() => {
        expect(fetchExport).toHaveBeenCalledTimes(2);
        expect(fetchExport).toHaveBeenNthCalledWith(1, "conn-1", undefined);
        expect(fetchExport).toHaveBeenNthCalledWith(2, "conn-1", "cursor-2");
      });
    });

    it("decrypts each entity and inserts into the friend table", async () => {
      fetchExport = vi.fn<FriendIndexerConfig["fetchExport"]>().mockResolvedValue({
        data: [{ id: "e-1", entityType: "member", encryptedData: "e-1", updatedAt: 1000 }],
        hasMore: false,
      });
      decryptEntity = vi
        .fn<FriendIndexerConfig["decryptEntity"]>()
        .mockReturnValue({ id: "e-1", name: "Alice" });

      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-1",
      });

      await vi.waitFor(() => {
        expect(decryptEntity).toHaveBeenCalledWith("e-1", "member");
        const insertCalls = getExecuteCalls(db).filter((call) =>
          call[0].includes("INSERT OR REPLACE INTO friend_members"),
        );
        expect(insertCalls.length).toBeGreaterThan(0);
      });
    });

    it("inserts connection_id as first column in every row", async () => {
      fetchExport = vi.fn<FriendIndexerConfig["fetchExport"]>().mockResolvedValue({
        data: [{ id: "e-1", entityType: "member", encryptedData: "e-1", updatedAt: 1000 }],
        hasMore: false,
      });
      decryptEntity = vi
        .fn<FriendIndexerConfig["decryptEntity"]>()
        .mockReturnValue({ id: "e-1", name: "Alice" });

      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-99",
      });

      await vi.waitFor(() => {
        const insertCalls = getExecuteCalls(db).filter((call) =>
          call[0].includes("INSERT OR REPLACE INTO friend_members"),
        );
        expect(insertCalls.length).toBeGreaterThan(0);
        const firstInsert = insertCalls[0];
        if (!firstInsert) throw new Error("Expected at least one insert call");
        const params = firstInsert[1];
        expect(params[0]).toBe("conn-99");
      });
    });

    it("emits friend:indexed after indexing", async () => {
      fetchExport = vi
        .fn<FriendIndexerConfig["fetchExport"]>()
        .mockResolvedValue({ data: [], hasMore: false });
      const indexedListener = vi.fn();
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });
      eventBus.on("friend:indexed", indexedListener);

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-1",
      });

      await vi.waitFor(() => {
        expect(indexedListener).toHaveBeenCalledWith({
          type: "friend:indexed",
          connectionId: "conn-1",
        });
      });
    });

    it("emits search:index-updated with scope 'friend' after indexing", async () => {
      fetchExport = vi
        .fn<FriendIndexerConfig["fetchExport"]>()
        .mockResolvedValue({ data: [], hasMore: false });
      const searchListener = vi.fn();
      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });
      eventBus.on("search:index-updated", searchListener);

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-1",
      });

      await vi.waitFor(() => {
        expect(searchListener).toHaveBeenCalledWith({
          type: "search:index-updated",
          scope: "friend",
        });
      });
    });

    it("skips entities with unknown entityType", async () => {
      fetchExport = vi.fn<FriendIndexerConfig["fetchExport"]>().mockResolvedValue({
        data: [{ id: "e-1", entityType: "unknown-type", encryptedData: "e-1", updatedAt: 1000 }],
        hasMore: false,
      });

      createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });

      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-1",
      });

      await vi.waitFor(() => {
        expect(fetchExport).toHaveBeenCalledOnce();
      });
      expect(decryptEntity).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("unsubscribes all listeners when cleanup is called", async () => {
      fetchExport = vi
        .fn<FriendIndexerConfig["fetchExport"]>()
        .mockResolvedValue({ data: [], hasMore: false });
      const cleanup = createFriendIndexer({ eventBus, db, fetchExport, decryptEntity });
      cleanup();

      eventBus.emit("ws:notification", {
        type: "ws:notification",
        payload: { kind: "friend-updated", connectionId: "conn-1" },
      });
      eventBus.emit("friend:data-changed", {
        type: "friend:data-changed",
        connectionId: "conn-1",
      });

      await Promise.resolve();
      expect(fetchExport).not.toHaveBeenCalled();
    });
  });
});
