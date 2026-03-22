import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { members } from "../schema/pg/members.js";
import {
  relationships,
  systemStructureEntityAssociations,
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "../schema/pg/structure.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgStructureTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  members,
  relationships,
  systemStructureEntityTypes,
  systemStructureEntities,
  systemStructureEntityLinks,
  systemStructureEntityMemberLinks,
  systemStructureEntityAssociations,
};

describe("PG structure schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => pgInsertMember(db, systemId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgStructureTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(systemStructureEntityAssociations);
    await db.delete(systemStructureEntityMemberLinks);
    await db.delete(systemStructureEntityLinks);
    await db.delete(systemStructureEntities);
    await db.delete(systemStructureEntityTypes);
    await db.delete(relationships);
  });

  // ── Primary entities ──────────────────────────────────────────────

  describe("relationships", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();
      await expect(
        db.insert(relationships).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();

      await expect(
        db.insert(relationships).values({
          id: crypto.randomUUID(),
          systemId,
          type: "invalid" as "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow(/check|constraint|failed query/i);
    });

    it("sets sourceMemberId to null on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        sourceMemberId: memberId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.sourceMemberId).toBeNull();
    });

    it("rejects nonexistent sourceMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(relationships).values({
          id: crypto.randomUUID(),
          systemId,
          sourceMemberId: "nonexistent",
          type: "sibling",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("sets targetMemberId to null on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        targetMemberId: memberId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(relationships).where(eq(relationships.id, id));
      expect(rows[0]?.targetMemberId).toBeNull();
    });

    it("rejects nonexistent targetMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(relationships).values({
          id: crypto.randomUUID(),
          systemId,
          targetMemberId: "nonexistent",
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(relationships).values({
        id,
        systemId,
        type: "sibling",
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const updateNow = Date.now();
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
      const now = Date.now();

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
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO relationships (id, system_id, type, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 'sibling', '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  // ── Structure Entity Types ─────────────────────────────────────────

  describe("systemStructureEntityTypes", () => {
    it("inserts and round-trips encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20]));

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects nonexistent systemId FK", async () => {
      const now = Date.now();
      await expect(
        db.insert(systemStructureEntityTypes).values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(systemStructureEntityTypes)
        .where(eq(systemStructureEntityTypes.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  // ── Structure Entities ─────────────────────────────────────────────

  describe("systemStructureEntities", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const entityId = crypto.randomUUID();
      const data = testBlob(new Uint8Array([30, 40]));
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.entityTypeId).toBe(typeId);
    });

    it("rejects nonexistent entityTypeId FK (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(systemStructureEntities).values({
          id: crypto.randomUUID(),
          systemId,
          entityTypeId: "nonexistent",
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("prevents deletion of entity type with dependent entities (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(systemStructureEntities).values({
        id: crypto.randomUUID(),
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.delete(systemStructureEntityTypes).where(eq(systemStructureEntityTypes.id, typeId)),
      ).rejects.toThrow();
    });

    it("defaults archived to false", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const entityId = crypto.randomUUID();
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const entityId = crypto.randomUUID();
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntities)
        .where(eq(systemStructureEntities.id, entityId));
      expect(rows[0]?.version).toBe(1);
    });
  });

  // ── Structure Entity Links ─────────────────────────────────────────

  describe("systemStructureEntityLinks", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const linkId = crypto.randomUUID();
      await db.insert(systemStructureEntityLinks).values({
        id: linkId,
        systemId,
        entityId,
        sortOrder: 0,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityLinks)
        .where(eq(systemStructureEntityLinks.id, linkId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityId).toBe(entityId);
      expect(rows[0]?.parentEntityId).toBeNull();
    });

    it("rejects nonexistent entityId FK (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(systemStructureEntityLinks).values({
          id: crypto.randomUUID(),
          systemId,
          entityId: "nonexistent",
          sortOrder: 0,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("prevents deletion of entity with dependent links (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntityLinks).values({
        id: crypto.randomUUID(),
        systemId,
        entityId,
        sortOrder: 0,
        createdAt: now,
      });

      await expect(
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, entityId)),
      ).rejects.toThrow();
    });
  });

  // ── Structure Entity Member Links ──────────────────────────────────

  describe("systemStructureEntityMemberLinks", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const typeId = crypto.randomUUID();
      const entityId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values({
        id: entityId,
        systemId,
        entityTypeId: typeId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });

      const linkId = crypto.randomUUID();
      await db.insert(systemStructureEntityMemberLinks).values({
        id: linkId,
        systemId,
        parentEntityId: entityId,
        memberId,
        sortOrder: 0,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityMemberLinks)
        .where(eq(systemStructureEntityMemberLinks.id, linkId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.parentEntityId).toBe(entityId);
    });

    it("rejects nonexistent memberId FK (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(systemStructureEntityMemberLinks).values({
          id: crypto.randomUUID(),
          systemId,
          memberId: "nonexistent",
          sortOrder: 0,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("prevents deletion of member with dependent links (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = Date.now();

      await db.insert(systemStructureEntityMemberLinks).values({
        id: crypto.randomUUID(),
        systemId,
        memberId,
        sortOrder: 0,
        createdAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });
  });

  // ── Structure Entity Associations ──────────────────────────────────

  describe("systemStructureEntityAssociations", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId1 = crypto.randomUUID();
      const entityId2 = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values([
        {
          id: entityId1,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: entityId2,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const assocId = crypto.randomUUID();
      await db.insert(systemStructureEntityAssociations).values({
        id: assocId,
        systemId,
        sourceEntityId: entityId1,
        targetEntityId: entityId2,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(systemStructureEntityAssociations)
        .where(eq(systemStructureEntityAssociations.id, assocId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sourceEntityId).toBe(entityId1);
      expect(rows[0]?.targetEntityId).toBe(entityId2);
    });

    it("enforces unique (sourceEntityId, targetEntityId)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId1 = crypto.randomUUID();
      const entityId2 = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values([
        {
          id: entityId1,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: entityId2,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);

      await db.insert(systemStructureEntityAssociations).values({
        id: crypto.randomUUID(),
        systemId,
        sourceEntityId: entityId1,
        targetEntityId: entityId2,
        createdAt: now,
      });

      await expect(
        db.insert(systemStructureEntityAssociations).values({
          id: crypto.randomUUID(),
          systemId,
          sourceEntityId: entityId1,
          targetEntityId: entityId2,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("prevents deletion of entity with dependent associations (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const typeId = crypto.randomUUID();
      const entityId1 = crypto.randomUUID();
      const entityId2 = crypto.randomUUID();
      const now = Date.now();

      await db.insert(systemStructureEntityTypes).values({
        id: typeId,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(systemStructureEntities).values([
        {
          id: entityId1,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: entityId2,
          systemId,
          entityTypeId: typeId,
          sortOrder: 1,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      await db.insert(systemStructureEntityAssociations).values({
        id: crypto.randomUUID(),
        systemId,
        sourceEntityId: entityId1,
        targetEntityId: entityId2,
        createdAt: now,
      });

      await expect(
        db.delete(systemStructureEntities).where(eq(systemStructureEntities.id, entityId1)),
      ).rejects.toThrow();
    });
  });
});
