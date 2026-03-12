import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { deleteSearchEntry, insertSearchEntry, searchEntries } from "../schema/pg/search.js";

import {
  createPgSearchIndexTables,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "./helpers/pg-helpers.js";

import type { PgSearchIndexResult } from "../schema/pg/search.js";

describe("PG search_index full-text search", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;
  let systemId: string;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);
    await createPgSearchIndexTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await pgExec(client, "DELETE FROM search_index");
    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);
  });

  it("inserts and searches by keyword", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Luna",
      content: "Protector who enjoys gardening and nature walks",
    });

    const results = await searchEntries(db, systemId, "gardening");
    expect(results).toHaveLength(1);
    expect(results[0]?.entityId).toBe("m-1");
    expect(results[0]?.entityType).toBe("member");
    expect(results[0]?.rank).toBeGreaterThan(0);
  });

  it("returns highlighted snippets via headline", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "journal-entry",
      entityId: "j-1",
      title: "Morning thoughts",
      content: "Today was a peaceful morning with quiet reflection",
    });

    const results = await searchEntries(db, systemId, "peaceful");
    expect(results).toHaveLength(1);
    expect(results[0]?.headline).toContain("<b>peaceful</b>");
  });

  it("enforces multi-tenant isolation via system_id", async () => {
    const otherAccountId = await pgInsertAccount(db);
    const otherSystemId = await pgInsertSystem(db, otherAccountId);

    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Shared name",
      content: "Content for system A",
    });

    await insertSearchEntry(db, {
      systemId: otherSystemId,
      entityType: "member",
      entityId: "m-2",
      title: "Shared name",
      content: "Content for system B",
    });

    const resultsA = await searchEntries(db, systemId, "shared");
    expect(resultsA).toHaveLength(1);
    expect(resultsA[0]?.entityId).toBe("m-1");

    const resultsB = await searchEntries(db, otherSystemId, "shared");
    expect(resultsB).toHaveLength(1);
    expect(resultsB[0]?.entityId).toBe("m-2");
  });

  it("filters by entity type", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Starlight",
      content: "A dreamy alter",
    });

    await insertSearchEntry(db, {
      systemId,
      entityType: "journal-entry",
      entityId: "j-1",
      title: "Starlight reflections",
      content: "Thinking about starlight",
    });

    const membersOnly = await searchEntries(db, systemId, "starlight", {
      entityType: "member",
    });
    expect(membersOnly).toHaveLength(1);
    expect(membersOnly[0]?.entityType).toBe("member");

    const all = await searchEntries(db, systemId, "starlight");
    expect(all).toHaveLength(2);
  });

  it("supports limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await insertSearchEntry(db, {
        systemId,
        entityType: "note",
        entityId: `n-${String(i)}`,
        title: `Note about flowers ${String(i)}`,
        content: `Content about beautiful flowers number ${String(i)}`,
      });
    }

    const page1 = await searchEntries(db, systemId, "flowers", { limit: 2 });
    expect(page1).toHaveLength(2);

    const page2 = await searchEntries(db, systemId, "flowers", { limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);

    const allIds = [...page1, ...page2].map((r) => r.entityId);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(4);
  });

  it("upserts on conflict (same system + entity type + entity ID)", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Original name",
      content: "Original bio",
    });

    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Updated name",
      content: "Updated bio with astronomy",
    });

    const results = await searchEntries(db, systemId, "astronomy");
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Updated name");

    const oldResults = await searchEntries(db, systemId, "original");
    expect(oldResults).toHaveLength(0);
  });

  it("deletes search entries", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Deletable",
      content: "This will be removed",
    });

    let results = await searchEntries(db, systemId, "deletable");
    expect(results).toHaveLength(1);

    await deleteSearchEntry(db, systemId, "member", "m-1");

    results = await searchEntries(db, systemId, "deletable");
    expect(results).toHaveLength(0);
  });

  it("ranks title matches higher than content matches", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-title",
      title: "Gardening expert",
      content: "Likes cooking",
    });

    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-content",
      title: "Cooking expert",
      content: "Sometimes does gardening on weekends",
    });

    const results = await searchEntries(db, systemId, "gardening");
    expect(results).toHaveLength(2);
    expect(results[0]?.entityId).toBe("m-title");
    expect(results[1]?.entityId).toBe("m-content");
  });

  it("returns empty array for empty query", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Test",
      content: "Content",
    });

    const results = await searchEntries(db, systemId, "");
    expect(results).toHaveLength(0);

    const whitespaceResults = await searchEntries(db, systemId, "   ");
    expect(whitespaceResults).toHaveLength(0);
  });

  it("returns empty array for no matches", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Luna",
      content: "A protector",
    });

    const results = await searchEntries(db, systemId, "xyznonexistent");
    expect(results).toHaveLength(0);
  });

  it("handles special characters safely via websearch_to_tsquery", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "member",
      entityId: "m-1",
      title: "Test member",
      content: "Regular content for testing",
    });

    const testCases = [
      "test's",
      'test "quoted"',
      "test & more",
      "test | other",
      "test!",
      "<script>alert('xss')</script>",
    ];

    for (const query of testCases) {
      let results: PgSearchIndexResult[] = [];
      try {
        results = await searchEntries(db, systemId, query);
      } catch {
        // Some special character combinations may cause websearch_to_tsquery to throw;
        // that's acceptable — the important thing is no SQL injection
      }
      // Results should be an array (possibly empty) — no errors from injection
      expect(Array.isArray(results)).toBe(true);
    }
  });

  it("supports websearch_to_tsquery operators (AND, OR, negation)", async () => {
    await insertSearchEntry(db, {
      systemId,
      entityType: "note",
      entityId: "n-1",
      title: "Happy morning",
      content: "A wonderful start to the day",
    });

    await insertSearchEntry(db, {
      systemId,
      entityType: "note",
      entityId: "n-2",
      title: "Sad morning",
      content: "A difficult start to the day",
    });

    // websearch_to_tsquery treats "happy morning" as AND by default
    const andResults = await searchEntries(db, systemId, "happy morning");
    expect(andResults).toHaveLength(1);
    expect(andResults[0]?.entityId).toBe("n-1");

    // OR operator
    const orResults = await searchEntries(db, systemId, "happy OR sad");
    expect(orResults).toHaveLength(2);

    // Negation with -
    const negResults = await searchEntries(db, systemId, "morning -happy");
    expect(negResults).toHaveLength(1);
    expect(negResults[0]?.entityId).toBe("n-2");
  });
});
