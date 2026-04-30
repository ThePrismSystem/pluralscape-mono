import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { members } from "../schema/pg/members.js";
import { relationships } from "../schema/pg/structure.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { testBlob } from "./helpers/pg-helpers.js";
import {
  newRelId,
  setupStructureFixture,
  teardownStructureFixture,
  clearStructureTables,
  insertAccount as insertAccountWith,
  insertSystem as insertSystemWith,
  insertMember as insertMemberWith,
  type StructureDb,
} from "./helpers/structure-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { MemberId, SystemId } from "@pluralscape/types";

describe("PG structure schema — relationships", () => {
  let client: PGlite;
  let db: StructureDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => insertMemberWith(db, systemId, id);

  beforeAll(async () => {
    const fixture = await setupStructureFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownStructureFixture({ client, db });
  });

  afterEach(async () => {
    await clearStructureTables(db);
  });

  describe("relationships", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newRelId();
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.systemId).toBe(systemId);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newRelId();
      const now = fixtureNow();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newRelId();
      const now = fixtureNow();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = fixtureNow();
      await expect(
        db.insert(relationships).values({
          id: newRelId(),
          systemId: brandId<SystemId>("nonexistent"),
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const sourceMemberId = await insertMember(systemId);
      const targetMemberId = await insertMember(systemId);
      const id = newRelId();
      const now = fixtureNow();

      await db.insert(relationships).values({
        id,
        systemId,
        sourceMemberId,
        targetMemberId,
        type: "sibling",
        bidirectional: true,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.sourceMemberId).toBe(sourceMemberId);
      expect(rows[0]?.targetMemberId).toBe(targetMemberId);
      expect(rows[0]?.type).toBe("sibling");
      expect(rows[0]?.bidirectional).toBe(true);
    });

    it("defaults T3 metadata to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newRelId();
      const now = fixtureNow();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.sourceMemberId).toBeNull();
      expect(rows[0]?.targetMemberId).toBeNull();
      expect(rows[0]?.type).toBe("sibling");
      expect(rows[0]?.bidirectional).toBe(false);
    });

    it("rejects invalid type via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(relationships).values({
          id: newRelId(),
          systemId,
          type: "invalid" as "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow(/check|constraint|failed query/i);
    });

    it("restricts member deletion when referenced as source in relationship", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await db.insert(relationships).values({
        id: newRelId(),
        systemId,
        sourceMemberId: memberId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("rejects nonexistent sourceMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(relationships).values({
          id: newRelId(),
          systemId,
          sourceMemberId: brandId<MemberId>("nonexistent"),
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("restricts member deletion when referenced as target in relationship", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await db.insert(relationships).values({
        id: newRelId(),
        systemId,
        targetMemberId: memberId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("rejects nonexistent targetMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        db.insert(relationships).values({
          id: newRelId(),
          systemId,
          targetMemberId: brandId<MemberId>("nonexistent"),
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newRelId();
      const now = fixtureNow();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newRelId();
      const now = fixtureNow();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = newRelId();
      const now = fixtureNow();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const updateNow = fixtureNow();
      await db
        .update(relationships)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(relationships.id, id));
      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO relationships (id, system_id, type, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'sibling', '\\x0102'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO relationships (id, system_id, type, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'sibling', '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
