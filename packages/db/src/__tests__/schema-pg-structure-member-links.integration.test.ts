import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { members } from "../schema/pg/members.js";
import {
  systemStructureEntities,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "../schema/pg/structure.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { testBlob } from "./helpers/pg-helpers.js";
import {
  asMemberId,
  newEntityId,
  newMemberLinkId,
  newTypeId,
  setupStructureFixture,
  teardownStructureFixture,
  clearStructureTables,
  insertAccount as insertAccountWith,
  insertMember as insertMemberWith,
  insertSystem as insertSystemWith,
  type StructureDb,
} from "./helpers/structure-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { SystemStructureEntityId } from "@pluralscape/types";

describe("PG structure schema — entity member links", () => {
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

  describe("systemStructureEntityMemberLinks", () => {
    it("inserts and round-trips data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

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

      const linkId = newMemberLinkId();
      await db.insert(systemStructureEntityMemberLinks).values({
        id: linkId,
        systemId,
        parentEntityId: entityId,
        memberId: asMemberId(memberId),
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
      const now = fixtureNow();

      await expect(
        db.insert(systemStructureEntityMemberLinks).values({
          id: newMemberLinkId(),
          systemId,
          memberId: asMemberId("nonexistent"),
          sortOrder: 0,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("prevents deletion of member with dependent links (RESTRICT)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await db.insert(systemStructureEntityMemberLinks).values({
        id: newMemberLinkId(),
        systemId,
        memberId: asMemberId(memberId),
        sortOrder: 0,
        createdAt: now,
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("enforces unique (memberId, parentEntityId)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

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

      await db.insert(systemStructureEntityMemberLinks).values({
        id: newMemberLinkId(),
        systemId,
        memberId: asMemberId(memberId),
        parentEntityId: entityId,
        sortOrder: 0,
        createdAt: now,
      });

      await expect(
        db.insert(systemStructureEntityMemberLinks).values({
          id: newMemberLinkId(),
          systemId,
          memberId: asMemberId(memberId),
          parentEntityId: entityId,
          sortOrder: 1,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("enforces unique memberId at root (parentEntityId = null)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await db.insert(systemStructureEntityMemberLinks).values({
        id: newMemberLinkId(),
        systemId,
        memberId: asMemberId(memberId),
        sortOrder: 0,
        createdAt: now,
      });

      await expect(
        db.insert(systemStructureEntityMemberLinks).values({
          id: newMemberLinkId(),
          systemId,
          memberId: asMemberId(memberId),
          sortOrder: 1,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const linkId = newMemberLinkId();
      const now = fixtureNow();

      await db.insert(systemStructureEntityMemberLinks).values({
        id: linkId,
        systemId,
        memberId: asMemberId(memberId),
        sortOrder: 0,
        createdAt: now,
      });

      await client.query("DELETE FROM systems WHERE id = $1", [systemId]);
      const result = await client.query(
        "SELECT * FROM system_structure_entity_member_links WHERE id = $1",
        [linkId],
      );
      expect(result.rows).toHaveLength(0);
    });

    it("rejects nonexistent parentEntityId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const now = fixtureNow();

      await expect(
        db.insert(systemStructureEntityMemberLinks).values({
          id: newMemberLinkId(),
          systemId,
          memberId: asMemberId(memberId),
          parentEntityId: brandId<SystemStructureEntityId>("nonexistent"),
          sortOrder: 0,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });
  });
});
