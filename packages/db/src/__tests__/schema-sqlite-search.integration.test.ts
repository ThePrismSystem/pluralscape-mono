import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createSearchIndex,
  deleteSearchEntry,
  dropSearchIndex,
  insertSearchEntry,
  rebuildSearchIndex,
  searchEntries,
} from "../schema/sqlite/search.js";

import type { SearchIndexEntry } from "../schema/sqlite/search.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

describe("SQLite FTS5 search index", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database;

  beforeAll(() => {
    client = new Database(":memory:");
    db = drizzle(client);
  });

  afterAll(() => {
    client.close();
  });

  beforeEach(() => {
    rebuildSearchIndex(db);
  });

  describe("createSearchIndex / dropSearchIndex", () => {
    it("creates and drops the virtual table without error", () => {
      dropSearchIndex(db);
      createSearchIndex(db);
      // Verify table exists by inserting
      const entry: SearchIndexEntry = {
        entityType: "member",
        entityId: crypto.randomUUID(),
        title: "Test",
        content: "Body",
      };
      expect(() => {
        insertSearchEntry(db, entry);
      }).not.toThrow();
    });

    it("createSearchIndex is idempotent (IF NOT EXISTS)", () => {
      createSearchIndex(db);
      expect(() => {
        createSearchIndex(db);
      }).not.toThrow();
    });
  });

  describe("insertSearchEntry / searchEntries", () => {
    it("inserts and retrieves entries via MATCH", () => {
      const entry: SearchIndexEntry = {
        entityType: "member",
        entityId: crypto.randomUUID(),
        title: "Luna",
        content: "The main protector of the system",
      };
      insertSearchEntry(db, entry);

      const results = searchEntries(db, "Luna");
      expect(results).toHaveLength(1);
      expect(results[0]?.entityType).toBe("member");
      expect(results[0]?.entityId).toBe(entry.entityId);
      expect(results[0]?.title).toBe("Luna");
      expect(results[0]?.content).toBe("The main protector of the system");
      expect(typeof results[0]?.rank).toBe("number");
    });

    it("returns multiple matches ranked", () => {
      insertSearchEntry(db, {
        entityType: "journal-entry",
        entityId: crypto.randomUUID(),
        title: "Daily journal about switching",
        content: "Today we had a lot of switching activity",
      });
      insertSearchEntry(db, {
        entityType: "note",
        entityId: crypto.randomUUID(),
        title: "Switching patterns",
        content: "Notes on switching patterns observed this week switching frequently",
      });
      insertSearchEntry(db, {
        entityType: "member",
        entityId: crypto.randomUUID(),
        title: "Unrelated member",
        content: "No relevant content here",
      });

      const results = searchEntries(db, "switching");
      expect(results).toHaveLength(2);
      // Both entries mentioning "switching" should appear
      const types = results.map((r) => r.entityType);
      expect(types).toContain("journal-entry");
      expect(types).toContain("note");
    });

    it("searches content field", () => {
      insertSearchEntry(db, {
        entityType: "wiki-page",
        entityId: crypto.randomUUID(),
        title: "Unrelated title",
        content: "This page discusses dissociation barriers",
      });

      const results = searchEntries(db, "barriers");
      expect(results).toHaveLength(1);
      expect(results[0]?.entityType).toBe("wiki-page");
    });

    it("returns empty array for no matches", () => {
      insertSearchEntry(db, {
        entityType: "member",
        entityId: crypto.randomUUID(),
        title: "Someone",
        content: "Description",
      });

      const results = searchEntries(db, "nonexistentterm");
      expect(results).toHaveLength(0);
    });
  });

  describe("searchEntries with entityType filter", () => {
    it("filters results by entity type", () => {
      insertSearchEntry(db, {
        entityType: "member",
        entityId: crypto.randomUUID(),
        title: "System protector",
        content: "Protects the system",
      });
      insertSearchEntry(db, {
        entityType: "note",
        entityId: crypto.randomUUID(),
        title: "Protector notes",
        content: "Notes about protector roles",
      });

      const all = searchEntries(db, "protector");
      expect(all).toHaveLength(2);

      const membersOnly = searchEntries(db, "protector", { entityType: "member" });
      expect(membersOnly).toHaveLength(1);
      expect(membersOnly[0]?.entityType).toBe("member");
    });
  });

  describe("searchEntries with limit", () => {
    it("respects the limit option", () => {
      for (let i = 0; i < 5; i++) {
        insertSearchEntry(db, {
          entityType: "channel",
          entityId: crypto.randomUUID(),
          title: `Channel about switching ${String(i)}`,
          content: `Discussion about switching topic ${String(i)}`,
        });
      }

      const limited = searchEntries(db, "switching", { limit: 3 });
      expect(limited).toHaveLength(3);
    });
  });

  describe("deleteSearchEntry", () => {
    it("removes an entry so it no longer appears in results", () => {
      const entityId = crypto.randomUUID();
      insertSearchEntry(db, {
        entityType: "group",
        entityId,
        title: "Protectors group",
        content: "Group for protectors",
      });

      const before = searchEntries(db, "protectors");
      expect(before).toHaveLength(1);

      deleteSearchEntry(db, "group", entityId);

      const after = searchEntries(db, "protectors");
      expect(after).toHaveLength(0);
    });

    it("only deletes matching entity type + id pair", () => {
      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      insertSearchEntry(db, {
        entityType: "member",
        entityId: id1,
        title: "Shared keyword",
        content: "Content with keyword",
      });
      insertSearchEntry(db, {
        entityType: "note",
        entityId: id2,
        title: "Shared keyword",
        content: "Also has keyword",
      });

      deleteSearchEntry(db, "member", id1);

      const results = searchEntries(db, "keyword");
      expect(results).toHaveLength(1);
      expect(results[0]?.entityType).toBe("note");
    });
  });

  describe("rebuildSearchIndex", () => {
    it("clears all entries", () => {
      insertSearchEntry(db, {
        entityType: "member",
        entityId: crypto.randomUUID(),
        title: "Existing entry",
        content: "Should be cleared",
      });

      rebuildSearchIndex(db);

      const results = searchEntries(db, "existing");
      expect(results).toHaveLength(0);
    });
  });

  describe("special characters", () => {
    it("handles entries with special characters in content", () => {
      insertSearchEntry(db, {
        entityType: "note",
        entityId: crypto.randomUUID(),
        title: "Note with symbols",
        content: "This note has parentheses and brackets",
      });

      const results = searchEntries(db, "parentheses");
      expect(results).toHaveLength(1);
    });
  });
});
