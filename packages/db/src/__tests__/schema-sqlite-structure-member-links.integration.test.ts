/**
 * SQLite structure schema — systemStructureEntityMemberLinks table.
 *
 * Covers: systemStructureEntityMemberLinks (7 tests).
 *
 * Source: schema-sqlite-structure.integration.test.ts (lines 1288-1511)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { members } from "../schema/sqlite/members.js";
import {
  systemStructureEntities,
  systemStructureEntityMemberLinks,
  systemStructureEntityTypes,
} from "../schema/sqlite/structure.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteStructureTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type {
  MemberId,
  SystemId,
  SystemStructureEntityId,
  SystemStructureEntityMemberLinkId,
  SystemStructureEntityTypeId,
} from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const newTypeId = (): SystemStructureEntityTypeId =>
  brandId<SystemStructureEntityTypeId>(crypto.randomUUID());
const newEntityId = (): SystemStructureEntityId =>
  brandId<SystemStructureEntityId>(crypto.randomUUID());
const newMemberLinkId = (): SystemStructureEntityMemberLinkId =>
  brandId<SystemStructureEntityMemberLinkId>(crypto.randomUUID());
const asMemberId = (id: string): MemberId => brandId<MemberId>(id);

const schema = {
  accounts,
  systems,
  members,
  systemStructureEntityTypes,
  systemStructureEntities,
  systemStructureEntityMemberLinks,
};

describe("SQLite structure schema — systemStructureEntityMemberLinks", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): SystemId =>
    sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string): MemberId =>
    brandId<MemberId>(sqliteInsertMember(db, systemId, id));

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteStructureTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(systemStructureEntityMemberLinks).run();
    db.delete(systemStructureEntities).run();
    db.delete(systemStructureEntityTypes).run();
  });

  describe("systemStructureEntityMemberLinks", () => {
    it("inserts and round-trips data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const linkId = newMemberLinkId();
      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: linkId,
          systemId,
          parentEntityId: entityId,
          memberId: asMemberId(memberId),
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(systemStructureEntityMemberLinks)
        .where(eq(systemStructureEntityMemberLinks.id, linkId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.parentEntityId).toBe(entityId);
    });

    it("rejects nonexistent memberId FK (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(systemStructureEntityMemberLinks)
          .values({
            id: newMemberLinkId(),
            systemId,
            memberId: asMemberId("nonexistent"),
            sortOrder: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("prevents deletion of member with dependent links (RESTRICT)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = fixtureNow();

      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: newMemberLinkId(),
          systemId,
          memberId: asMemberId(memberId),
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() => db.delete(members).where(eq(members.id, memberId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
    });

    it("enforces unique (memberId, parentEntityId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const typeId = newTypeId();
      const entityId = newEntityId();
      const now = fixtureNow();

      db.insert(systemStructureEntityTypes)
        .values({
          id: typeId,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();
      db.insert(systemStructureEntities)
        .values({
          id: entityId,
          systemId,
          entityTypeId: typeId,
          sortOrder: 0,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: newMemberLinkId(),
          systemId,
          memberId: asMemberId(memberId),
          parentEntityId: entityId,
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityMemberLinks)
          .values({
            id: newMemberLinkId(),
            systemId,
            memberId: asMemberId(memberId),
            parentEntityId: entityId,
            sortOrder: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("enforces unique memberId at root (parentEntityId = null)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = fixtureNow();

      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: newMemberLinkId(),
          systemId,
          memberId: asMemberId(memberId),
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(systemStructureEntityMemberLinks)
          .values({
            id: newMemberLinkId(),
            systemId,
            memberId: asMemberId(memberId),
            sortOrder: 1,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const linkId = newMemberLinkId();
      const now = fixtureNow();

      db.insert(systemStructureEntityMemberLinks)
        .values({
          id: linkId,
          systemId,
          memberId: asMemberId(memberId),
          sortOrder: 0,
          createdAt: now,
        })
        .run();

      client.prepare("DELETE FROM systems WHERE id = ?").run(systemId);
      const rows = client
        .prepare("SELECT * FROM system_structure_entity_member_links WHERE id = ?")
        .all(linkId);
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent parentEntityId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(systemStructureEntityMemberLinks)
          .values({
            id: newMemberLinkId(),
            systemId,
            memberId: asMemberId(memberId),
            parentEntityId: brandId<SystemStructureEntityId>("nonexistent"),
            sortOrder: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });
  });
});
