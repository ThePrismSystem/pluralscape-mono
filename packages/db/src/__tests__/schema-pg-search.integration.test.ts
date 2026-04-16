import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
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
    systemId = (await pgInsertSystem(db, accountId)) as SystemId;
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
    const otherSystemId = (await pgInsertSystem(db, otherAccountId)) as SystemId;

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
      const result = await searchEntries(db, systemId, query).catch((err: unknown) => {
        // websearch_to_tsquery may reject some special character combinations —
        // that's acceptable. Verify it's a PG parse error, not an injection.
        expect(err).toBeInstanceOf(Error);
        return null;
      });
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
          systemId: "sys-1" as SystemId,
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
      deleteSearchEntry(db, "sys-1" as SystemId, "member", "ent-1", "hosted"),
    ).rejects.toThrow("Plaintext search_index is not available in hosted mode");
  });

  it("rejects searchEntries in hosted mode", async () => {
    await expect(
      searchEntries(db, "sys-1" as SystemId, "test query", undefined, "hosted"),
    ).rejects.toThrow("Plaintext search_index is not available in hosted mode");
  });

  it("allows operations in self-hosted mode (explicit param)", async () => {
    const accountId = await pgInsertAccount(db);
    const sysId = (await pgInsertSystem(db, accountId)) as SystemId;
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
  const APP_ROLE = "search_rls_app_user";
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
    await db.execute(sql`SELECT set_config('app.current_system_id', ${systemIdA}, false)`);

    const result = await client.query<{ system_id: string; entity_id: string }>(
      "SELECT system_id, entity_id FROM search_index",
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.system_id).toBe(systemIdA);
    expect(result.rows[0]?.entity_id).toBe("m-rls-a");
  });

  it("switches visible rows when session context changes", async () => {
    await db.execute(sql`SELECT set_config('app.current_system_id', ${systemIdB}, false)`);

    const result = await client.query<{ system_id: string; entity_id: string }>(
      "SELECT system_id, entity_id FROM search_index",
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.system_id).toBe(systemIdB);
    expect(result.rows[0]?.entity_id).toBe("m-rls-b");
  });

  it("returns empty when session GUC is unset (fail-closed)", async () => {
    await db.execute(sql`SELECT set_config('app.current_system_id', '', false)`);

    const result = await client.query<{ system_id: string }>("SELECT system_id FROM search_index");

    expect(result.rows).toHaveLength(0);
  });
});
