import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { and, eq, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { checkDependents } from "../../lib/check-dependents.js";
import { asDb } from "../helpers/integration-setup.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const { members, notes } = schema;

/**
 * Integration tests for the predicate-agnostic `checkDependents` helper.
 * Uses PGlite-backed `members` + `notes` tables as stand-in dependents so
 * tests can freely toggle counts without coupling to production schemas.
 */
describe("checkDependents (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let systemId: string;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    // createPgCommunicationTables sets up accounts + systems + members + notes.
    await createPgCommunicationTables(client);
    const accountId = await pgInsertAccount(db);
    systemId = await pgInsertSystem(db, accountId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(members);
    await db.delete(notes);
  });

  async function insertMember(id: string): Promise<void> {
    const now = Date.now();
    await db.insert(members).values({
      id,
      systemId,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
      version: 1,
      archived: false,
      archivedAt: null,
    });
  }

  async function insertNote(id: string): Promise<void> {
    const now = Date.now();
    await db.insert(notes).values({
      id,
      systemId,
      authorEntityType: null,
      authorEntityId: null,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
      version: 1,
      archived: false,
      archivedAt: null,
    });
  }

  it("returns an empty result and does not touch the DB when checks is empty", async () => {
    // Spy-free assertion: we call against a valid DB to confirm no query error
    // and the short-circuit path yields the expected shape.
    const result = await checkDependents(asDb(db), []);
    expect(result).toEqual({ dependents: [] });
  });

  it("returns an empty dependents array when every check counts zero", async () => {
    const result = await checkDependents(asDb(db), [
      {
        table: members,
        predicate: eq(members.systemId, systemId),
        typeName: "member",
      },
      {
        table: notes,
        predicate: eq(notes.systemId, systemId),
        typeName: "note",
      },
    ]);

    expect(result).toEqual({ dependents: [] });
  });

  it("reports a single non-zero count with the caller-supplied type name", async () => {
    await insertMember("mem_single_1");
    await insertMember("mem_single_2");

    const result = await checkDependents(asDb(db), [
      {
        table: members,
        predicate: eq(members.systemId, systemId),
        typeName: "member",
      },
    ]);

    expect(result).toEqual({ dependents: [{ type: "member", count: 2 }] });
  });

  it("filters out zero counts and preserves input order for non-zero ones", async () => {
    // Input order: members (zero), notes (non-zero), members-again (non-zero).
    // Expected output preserves the order of the two non-zero checks.
    await insertNote("note_mixed_1");
    await insertNote("note_mixed_2");
    await insertNote("note_mixed_3");
    await insertMember("mem_mixed_1");

    const result = await checkDependents(asDb(db), [
      {
        // Zero-count predicate: restrict to an impossible systemId.
        table: members,
        predicate: eq(members.systemId, "nonexistent-system"),
        typeName: "archived-member",
      },
      {
        table: notes,
        predicate: eq(notes.systemId, systemId),
        typeName: "note",
      },
      {
        table: members,
        predicate: eq(members.systemId, systemId),
        typeName: "member",
      },
    ]);

    expect(result.dependents).toEqual([
      { type: "note", count: 3 },
      { type: "member", count: 1 },
    ]);
  });

  it("accepts arbitrary SQL predicates (OR / raw sql) not shaped like entity-scope filters", async () => {
    // Prove the helper is predicate-agnostic: this OR across two id patterns
    // has nothing to do with the old helper's (entityColumn=? AND systemColumn=?) shape.
    await insertMember("mem_arbitrary_a");
    await insertMember("mem_arbitrary_b");
    await insertMember("mem_arbitrary_c");

    const predicate = and(
      eq(members.systemId, systemId),
      or(eq(members.id, "mem_arbitrary_a"), sql`${members.id} = 'mem_arbitrary_c'`),
    );
    if (!predicate) {
      expect.unreachable("drizzle `and` returned undefined for a non-empty input");
    }

    const result = await checkDependents(asDb(db), [
      {
        table: members,
        predicate,
        typeName: "member",
      },
    ]);

    expect(result).toEqual({ dependents: [{ type: "member", count: 2 }] });
  });
});
