import { ENTITY_METADATA } from "@pluralscape/sync/materializer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { executeSearch } from "../use-search.js";

import type { LocalDatabase } from "../../data/local-database.js";
import type { EntityMetadata } from "@pluralscape/sync/materializer";

// ── Helpers ───────────────────────────────────────────────────────────

interface DbFixture {
  readonly db: LocalDatabase;
  readonly queryAllMock: ReturnType<typeof vi.fn>;
}

function makeDb(rows: Record<string, unknown>[] = []): DbFixture {
  const queryAllMock = vi.fn().mockResolvedValue(rows);
  const db: LocalDatabase = {
    initialize: vi.fn(() => Promise.resolve()),
    queryAll: queryAllMock,
    queryOne: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn(() => Promise.resolve()),
    transaction: vi.fn(
      <T>(fn: () => Promise<T>): Promise<T> => fn(),
    ) as LocalDatabase["transaction"],
    close: vi.fn(() => Promise.resolve()),
  };
  return { db, queryAllMock };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("executeSearch", () => {
  let fixture: DbFixture;

  beforeEach(() => {
    fixture = makeDb();
    vi.clearAllMocks();
  });

  describe("empty / whitespace query", () => {
    it("returns empty array for empty string", async () => {
      const results = await executeSearch(fixture.db, "", "all");
      expect(results).toEqual([]);
      expect(fixture.queryAllMock).not.toHaveBeenCalled();
    });

    it("returns empty array for whitespace-only string", async () => {
      const results = await executeSearch(fixture.db, "   ", "all");
      expect(results).toEqual([]);
      expect(fixture.queryAllMock).not.toHaveBeenCalled();
    });
  });

  describe("FTS5 query execution", () => {
    it("executes queries against fts_ tables for self scope", async () => {
      await executeSearch(fixture.db, "alice", "self");

      const calls = fixture.queryAllMock.mock.calls as [string, unknown[]][];
      expect(calls.length).toBeGreaterThan(0);

      // All SQL should reference fts_ tables (not fts_friend_)
      for (const [sql] of calls) {
        expect(sql).toMatch(/fts_/);
        // Must not query friend tables in self scope
        expect(sql).not.toMatch(/fts_friend_/);
      }
    });

    it("executes queries against fts_friend_ tables for friends scope", async () => {
      await executeSearch(fixture.db, "alice", "friends");

      const calls = fixture.queryAllMock.mock.calls as [string, unknown[]][];
      expect(calls.length).toBeGreaterThan(0);

      // All SQL should reference fts_friend_ tables
      for (const [sql] of calls) {
        expect(sql).toMatch(/fts_friend_/);
        expect(sql).not.toMatch(/(?<![_a-z])fts_(?!friend_)/);
      }
    });

    it("queries both self and friend tables for all scope", async () => {
      await executeSearch(fixture.db, "alice", "all");

      const calls = fixture.queryAllMock.mock.calls as [string, unknown[]][];
      const sqls = calls.map(([sql]) => sql);

      const hasSelf = sqls.some((sql) => /fts_\w/.test(sql) && !/fts_friend_/.test(sql));
      const hasFriend = sqls.some((sql) => /fts_friend_/.test(sql));
      expect(hasSelf).toBe(true);
      expect(hasFriend).toBe(true);
    });

    it("appends * to each word for prefix matching", async () => {
      await executeSearch(fixture.db, "alice bob", "self");

      const calls = fixture.queryAllMock.mock.calls as [string, unknown[]][];
      // The FTS query param should be "alice* bob*"
      for (const [, params] of calls) {
        expect(params[0]).toBe("alice* bob*");
      }
    });

    it("uses friend_ base table for friend scope JOIN (not base table)", async () => {
      await executeSearch(fixture.db, "alice", "friends");

      const calls = fixture.queryAllMock.mock.calls as [string, unknown[]][];
      for (const [sql] of calls) {
        // The SELECT and JOIN should reference friend_<table>, not the bare table
        const joinMatch = /JOIN\s+(\w+)\s+ON/.exec(sql);
        expect(joinMatch).not.toBeNull();
        if (joinMatch === null) return;
        const joinedTable = joinMatch[1] ?? "";
        expect(joinedTable).toMatch(/^friend_/);
      }
    });

    it("only queries entity types with non-empty ftsColumns", async () => {
      await executeSearch(fixture.db, "test", "self");

      // Count expected searchable entity types (those with ftsColumns.length > 0)
      const searchableCount = Object.values(ENTITY_METADATA).filter(
        (def: EntityMetadata) => def.ftsColumns.length > 0,
      ).length;

      // For self scope, one query per searchable entity type
      expect(fixture.queryAllMock.mock.calls.length).toBe(searchableCount);
    });
  });

  describe("result shape", () => {
    it("returns results as discriminated union with type, id, rank, data", async () => {
      const mockRows = [{ id: "m-1", name: "Alice", rank: -0.5 }];
      const { db } = makeDb(mockRows);

      const results = await executeSearch(db, "alice", "self");

      expect(results.length).toBeGreaterThan(0);
      const [first] = results;
      expect(first).toHaveProperty("type");
      expect(first).toHaveProperty("id", "m-1");
      expect(first).toHaveProperty("rank", -0.5);
      expect(first).toHaveProperty("data");
      expect(first?.data).toMatchObject({ id: "m-1", name: "Alice" });
    });

    it("tags self results with bare entity type string", async () => {
      const mockRows = [{ id: "m-1", name: "Alice", rank: -1.0 }];
      const { db } = makeDb(mockRows);

      const results = await executeSearch(db, "alice", "self");
      const memberResults = results.filter((r) => r.type === "member");
      expect(memberResults.length).toBeGreaterThan(0);
    });

    it("tags friend results with friend- prefixed entity type string", async () => {
      const mockRows = [{ id: "m-1", name: "Alice", rank: -1.0 }];
      const { db } = makeDb(mockRows);

      const results = await executeSearch(db, "alice", "friends");
      const friendMemberResults = results.filter((r) => r.type === "friend-member");
      expect(friendMemberResults.length).toBeGreaterThan(0);
    });
  });

  describe("sorting", () => {
    it("sorts results by rank ascending (lower = more relevant)", async () => {
      // First call returns a low-relevance result, second returns high-relevance
      const callIndex = { current: 0 };
      const queryAllMock = vi.fn().mockImplementation(() => {
        const idx = callIndex.current++;
        if (idx === 0) return Promise.resolve([{ id: "m-less", rank: -0.5 }]);
        if (idx === 1) return Promise.resolve([{ id: "m-more", rank: -2.0 }]);
        return Promise.resolve([]);
      });
      const db2: LocalDatabase = {
        initialize: vi.fn(() => Promise.resolve()),
        queryAll: queryAllMock,
        queryOne: vi.fn(() => Promise.resolve(undefined)),
        execute: vi.fn(() => Promise.resolve()),
        transaction: vi.fn(
          <T>(fn: () => Promise<T>): Promise<T> => fn(),
        ) as LocalDatabase["transaction"],
        close: vi.fn(() => Promise.resolve()),
      };

      const results = await executeSearch(db2, "test", "self");
      // Lower rank value = more relevant = should come first
      expect(results[0]?.rank).toBeLessThanOrEqual(results[1]?.rank ?? Infinity);
    });

    it("returns empty array when no rows match", async () => {
      const results = await executeSearch(fixture.db, "xyzzy", "all");
      expect(results).toEqual([]);
    });
  });

  describe("SQL structure", () => {
    it("uses JOIN between fts table and base table", async () => {
      await executeSearch(fixture.db, "test", "self");

      const calls = fixture.queryAllMock.mock.calls as [string, unknown[]][];
      for (const [sql] of calls) {
        expect(sql).toMatch(/JOIN/i);
        expect(sql).toMatch(/WHERE/i);
        expect(sql).toMatch(/MATCH/i);
        expect(sql).toMatch(/ORDER BY/i);
        expect(sql).toMatch(/LIMIT 20/i);
      }
    });
  });
});
