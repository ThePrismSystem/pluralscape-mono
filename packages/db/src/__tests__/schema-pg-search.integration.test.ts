import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getDeploymentMode } from "../deployment.js";
import { generateRlsStatements } from "../rls/policies.js";
import {
  createSearchIndex,
  createSearchIndexIndexes,
  deleteSearchEntry,
  insertSearchEntry,
  rebuildSearchIndex,
  searchEntries,
} from "../schema/pg/search.js";

import {
  createPgSearchIndexTables,
  pgExec,
  pgInsertAccount,
  pgInsertSystem,
} from "./helpers/pg-helpers.js";
import { APP_ROLE, clearSessionContext, setSessionSystemId } from "./helpers/rls-test-helpers.js";

import type { SystemId } from "@pluralscape/types";

describe("PG search_index full-text search", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;
  let systemId: SystemId;

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
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
  });

  it("inserts and searches by keyword", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Luna",
        content: "Protector who enjoys gardening and nature walks",
      },
      "self-hosted",
    );

    const results = await searchEntries(db, systemId, "gardening", undefined, "self-hosted");
    expect(results).toHaveLength(1);
    expect(results[0]?.entityId).toBe("m-1");
    expect(results[0]?.entityType).toBe("member");
    expect(results[0]?.rank).toBeGreaterThan(0);
  });

  it("returns highlighted snippets via headline", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "journal-entry",
        entityId: "j-1",
        title: "Morning thoughts",
        content: "Today was a peaceful morning with quiet reflection",
      },
      "self-hosted",
    );

    const results = await searchEntries(db, systemId, "peaceful", undefined, "self-hosted");
    expect(results).toHaveLength(1);
    expect(results[0]?.headline).toContain("<b>peaceful</b>");
  });

  it("enforces multi-tenant isolation via system_id", async () => {
    const otherAccountId = await pgInsertAccount(db);
    const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, otherAccountId));

    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Shared name",
        content: "Content for system A",
      },
      "self-hosted",
    );

    await insertSearchEntry(
      db,
      {
        systemId: otherSystemId,
        entityType: "member",
        entityId: "m-2",
        title: "Shared name",
        content: "Content for system B",
      },
      "self-hosted",
    );

    const resultsA = await searchEntries(db, systemId, "shared", undefined, "self-hosted");
    expect(resultsA).toHaveLength(1);
    expect(resultsA[0]?.entityId).toBe("m-1");

    const resultsB = await searchEntries(db, otherSystemId, "shared", undefined, "self-hosted");
    expect(resultsB).toHaveLength(1);
    expect(resultsB[0]?.entityId).toBe("m-2");
  });

  it("filters by entity type", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Starlight",
        content: "A dreamy alter",
      },
      "self-hosted",
    );

    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "journal-entry",
        entityId: "j-1",
        title: "Starlight reflections",
        content: "Thinking about starlight",
      },
      "self-hosted",
    );

    const membersOnly = await searchEntries(
      db,
      systemId,
      "starlight",
      {
        entityType: "member",
      },
      "self-hosted",
    );
    expect(membersOnly).toHaveLength(1);
    expect(membersOnly[0]?.entityType).toBe("member");

    const all = await searchEntries(db, systemId, "starlight", undefined, "self-hosted");
    expect(all).toHaveLength(2);
  });

  it("supports limit and offset", async () => {
    for (let i = 0; i < 5; i++) {
      await insertSearchEntry(
        db,
        {
          systemId,
          entityType: "note",
          entityId: `n-${String(i)}`,
          title: `Note about flowers ${String(i)}`,
          content: `Content about beautiful flowers number ${String(i)}`,
        },
        "self-hosted",
      );
    }

    const page1 = await searchEntries(db, systemId, "flowers", { limit: 2 }, "self-hosted");
    expect(page1).toHaveLength(2);

    const page2 = await searchEntries(
      db,
      systemId,
      "flowers",
      { limit: 2, offset: 2 },
      "self-hosted",
    );
    expect(page2).toHaveLength(2);

    const allIds = [...page1, ...page2].map((r) => r.entityId);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(4);
  });

  it("upserts on conflict (same system + entity type + entity ID)", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Original name",
        content: "Original bio",
      },
      "self-hosted",
    );

    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Updated name",
        content: "Updated bio with astronomy",
      },
      "self-hosted",
    );

    const results = await searchEntries(db, systemId, "astronomy", undefined, "self-hosted");
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Updated name");

    const oldResults = await searchEntries(db, systemId, "original", undefined, "self-hosted");
    expect(oldResults).toHaveLength(0);
  });

  it("deletes search entries", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Deletable",
        content: "This will be removed",
      },
      "self-hosted",
    );

    let results = await searchEntries(db, systemId, "deletable", undefined, "self-hosted");
    expect(results).toHaveLength(1);

    await deleteSearchEntry(db, systemId, "member", "m-1", "self-hosted");

    results = await searchEntries(db, systemId, "deletable", undefined, "self-hosted");
    expect(results).toHaveLength(0);
  });

  it("ranks title matches higher than content matches", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-title",
        title: "Gardening expert",
        content: "Likes cooking",
      },
      "self-hosted",
    );

    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-content",
        title: "Cooking expert",
        content: "Sometimes does gardening on weekends",
      },
      "self-hosted",
    );

    const results = await searchEntries(db, systemId, "gardening", undefined, "self-hosted");
    expect(results).toHaveLength(2);
    expect(results[0]?.entityId).toBe("m-title");
    expect(results[1]?.entityId).toBe("m-content");
  });

  it("returns empty array for empty query", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Test",
        content: "Content",
      },
      "self-hosted",
    );

    const results = await searchEntries(db, systemId, "", undefined, "self-hosted");
    expect(results).toHaveLength(0);

    const whitespaceResults = await searchEntries(db, systemId, "   ", undefined, "self-hosted");
    expect(whitespaceResults).toHaveLength(0);
  });

  it("returns empty array for no matches", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Luna",
        content: "A protector",
      },
      "self-hosted",
    );

    const results = await searchEntries(db, systemId, "xyznonexistent", undefined, "self-hosted");
    expect(results).toHaveLength(0);
  });

  it("handles special characters safely via websearch_to_tsquery", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "member",
        entityId: "m-1",
        title: "Test member",
        content: "Regular content for testing",
      },
      "self-hosted",
    );

    const testCases = [
      "test's",
      'test "quoted"',
      "test & more",
      "test | other",
      "test!",
      "<script>alert('xss')</script>",
    ];

    for (const query of testCases) {
      const result = await searchEntries(db, systemId, query, undefined, "self-hosted").catch(
        (err: unknown) => {
          // websearch_to_tsquery may reject some special character combinations —
          // that's acceptable. Verify it's a PG parse error, not an injection.
          expect(err).toBeInstanceOf(Error);
          return null;
        },
      );
      if (result !== null) {
        expect(Array.isArray(result)).toBe(true);
        for (const entry of result) {
          expect(entry).toHaveProperty("entityType");
          expect(entry).toHaveProperty("entityId");
        }
      }
    }
  });

  it("supports websearch_to_tsquery operators (AND, OR, negation)", async () => {
    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "note",
        entityId: "n-1",
        title: "Happy morning",
        content: "A wonderful start to the day",
      },
      "self-hosted",
    );

    await insertSearchEntry(
      db,
      {
        systemId,
        entityType: "note",
        entityId: "n-2",
        title: "Sad morning",
        content: "A difficult start to the day",
      },
      "self-hosted",
    );

    // websearch_to_tsquery treats "happy morning" as AND by default
    const andResults = await searchEntries(db, systemId, "happy morning", undefined, "self-hosted");
    expect(andResults).toHaveLength(1);
    expect(andResults[0]?.entityId).toBe("n-1");

    // OR operator
    const orResults = await searchEntries(db, systemId, "happy OR sad", undefined, "self-hosted");
    expect(orResults).toHaveLength(2);

    // Negation with -
    const negResults = await searchEntries(
      db,
      systemId,
      "morning -happy",
      undefined,
      "self-hosted",
    );
    expect(negResults).toHaveLength(1);
    expect(negResults[0]?.entityId).toBe("n-2");
  });
});

describe("PG search_index hosted-mode guard", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);
    await createPgSearchIndexTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await pgExec(client, "DELETE FROM search_index");
    await pgExec(client, "DELETE FROM systems");
    await pgExec(client, "DELETE FROM accounts");
  });

  it("createSearchIndex throws in hosted mode", async () => {
    await expect(createSearchIndex(db, "hosted")).rejects.toThrow(
      "Plaintext search_index is not available in hosted mode",
    );
  });

  it("insertSearchEntry throws in hosted mode", async () => {
    await expect(
      insertSearchEntry(
        db,
        {
          systemId: brandId<SystemId>("sys-1"),
          entityType: "member",
          entityId: "m-1",
          title: "test",
          content: "test",
        },
        "hosted",
      ),
    ).rejects.toThrow("Plaintext search_index is not available in hosted mode");
  });

  it("rebuildSearchIndex throws in hosted mode", async () => {
    await expect(rebuildSearchIndex(db, "hosted")).rejects.toThrow(
      "Plaintext search_index is not available in hosted mode",
    );
  });

  it("createSearchIndexIndexes throws in hosted mode", async () => {
    await expect(createSearchIndexIndexes(db, "hosted")).rejects.toThrow(
      "Plaintext search_index is not available in hosted mode",
    );
  });

  it("rejects deleteSearchEntry in hosted mode", async () => {
    await expect(
      deleteSearchEntry(db, brandId<SystemId>("sys-1"), "member", "ent-1", "hosted"),
    ).rejects.toThrow("Plaintext search_index is not available in hosted mode");
  });

  it("rejects searchEntries in hosted mode", async () => {
    await expect(
      searchEntries(db, brandId<SystemId>("sys-1"), "test query", undefined, "hosted"),
    ).rejects.toThrow("Plaintext search_index is not available in hosted mode");
  });

  it("allows operations in self-hosted mode (explicit param)", async () => {
    const accountId = await pgInsertAccount(db);
    const sysId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    await expect(
      insertSearchEntry(
        db,
        {
          systemId: sysId,
          entityType: "member",
          entityId: "m-guard-test",
          title: "guard test",
          content: "should succeed",
        },
        "self-hosted",
      ),
    ).resolves.toBeUndefined();
  });

  it("allows deleteSearchEntry in self-hosted mode (explicit param)", async () => {
    const accountId = await pgInsertAccount(db);
    const sysId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    await insertSearchEntry(
      db,
      {
        systemId: sysId,
        entityType: "member",
        entityId: "m-del-1",
        title: "deletable entry",
        content: "deletable entry",
      },
      "self-hosted",
    );
    await deleteSearchEntry(db, sysId, "member", "m-del-1", "self-hosted");
    const results = await searchEntries(db, sysId, "deletable", undefined, "self-hosted");
    expect(results).toHaveLength(0);
  });

  it("allows searchEntries in self-hosted mode (explicit param)", async () => {
    const accountId = await pgInsertAccount(db);
    const sysId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    await insertSearchEntry(
      db,
      {
        systemId: sysId,
        entityType: "member",
        entityId: "m-search-1",
        title: "findable entry",
        content: "findable entry",
      },
      "self-hosted",
    );
    const results = await searchEntries(db, sysId, "findable", undefined, "self-hosted");
    expect(results).toHaveLength(1);
  });
});

describe("getDeploymentMode", () => {
  const originalEnv = process.env["DEPLOYMENT_MODE"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["DEPLOYMENT_MODE"];
    } else {
      process.env["DEPLOYMENT_MODE"] = originalEnv;
    }
  });

  it("returns 'self-hosted' when DEPLOYMENT_MODE is unset", () => {
    delete process.env["DEPLOYMENT_MODE"];
    expect(getDeploymentMode()).toBe("self-hosted");
  });

  it("returns 'hosted' when DEPLOYMENT_MODE is 'hosted'", () => {
    process.env["DEPLOYMENT_MODE"] = "hosted";
    expect(getDeploymentMode()).toBe("hosted");
  });

  it("returns 'self-hosted' when DEPLOYMENT_MODE is 'self-hosted'", () => {
    process.env["DEPLOYMENT_MODE"] = "self-hosted";
    expect(getDeploymentMode()).toBe("self-hosted");
  });

  it("returns 'self-hosted' for unrecognized values (fail-safe)", () => {
    process.env["DEPLOYMENT_MODE"] = "cloud";
    expect(getDeploymentMode()).toBe("self-hosted");
  });
});

describe("PG search_index RLS policy enforcement", () => {
  let client: PGlite;
  let db: ReturnType<typeof drizzle>;
  let systemIdA: string;
  let systemIdB: string;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client);

    await createPgSearchIndexTables(client);

    // Insert test data as superuser (bypasses RLS)
    const accountIdA = await pgInsertAccount(db);
    const accountIdB = await pgInsertAccount(db);
    systemIdA = await pgInsertSystem(db, accountIdA);
    systemIdB = await pgInsertSystem(db, accountIdB);

    await client.query(
      `INSERT INTO search_index (system_id, entity_type, entity_id, title, content)
       VALUES ($1, 'member', 'm-rls-a', 'Member A', 'Content for system A')`,
      [systemIdA],
    );
    await client.query(
      `INSERT INTO search_index (system_id, entity_type, entity_id, title, content)
       VALUES ($1, 'member', 'm-rls-b', 'Member B', 'Content for system B')`,
      [systemIdB],
    );

    // Grant table access to the app role
    await client.query(`CREATE ROLE ${APP_ROLE}`);
    await client.query(`GRANT ALL ON accounts TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON systems TO ${APP_ROLE}`);
    await client.query(`GRANT ALL ON search_index TO ${APP_ROLE}`);

    // Apply RLS using generateRlsStatements (same path as production)
    for (const stmt of generateRlsStatements("search_index")) {
      await client.query(stmt);
    }

    await client.query(`SET ROLE ${APP_ROLE}`);
  });

  afterAll(async () => {
    await client.close();
  });

  it("only returns rows for the active session system", async () => {
    await setSessionSystemId(db, systemIdA);

    const result = await client.query<{ system_id: string; entity_id: string }>(
      "SELECT system_id, entity_id FROM search_index",
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.system_id).toBe(systemIdA);
    expect(result.rows[0]?.entity_id).toBe("m-rls-a");
  });

  it("switches visible rows when session context changes", async () => {
    await setSessionSystemId(db, systemIdB);

    const result = await client.query<{ system_id: string; entity_id: string }>(
      "SELECT system_id, entity_id FROM search_index",
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.system_id).toBe(systemIdB);
    expect(result.rows[0]?.entity_id).toBe("m-rls-b");
  });

  it("returns empty when session GUC is unset (fail-closed)", async () => {
    await clearSessionContext(db);

    const result = await client.query<{ system_id: string }>("SELECT system_id FROM search_index");

    expect(result.rows).toHaveLength(0);
  });
});
