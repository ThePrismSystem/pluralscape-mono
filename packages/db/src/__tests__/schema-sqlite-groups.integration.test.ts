import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { groupMemberships, groups } from "../schema/sqlite/groups.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteGroupsTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { GroupId, SystemId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  members,
  groups,
  groupMemberships,
};

describe("SQLite groups schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string): string =>
    sqliteInsertMember(db, systemId, id);

  function insertGroup(
    systemId: string,
    opts: {
      id?: string;
      parentGroupId?: string | null;
      sortOrder?: number;
    } = {},
  ): GroupId {
    const id = brandId<GroupId>(opts.id ?? crypto.randomUUID());
    const now = Date.now();
    db.insert(groups)
      .values({
        id,
        systemId: brandId<SystemId>(systemId),
        parentGroupId: opts.parentGroupId === null || opts.parentGroupId === undefined
          ? null
          : brandId<GroupId>(opts.parentGroupId),
        sortOrder: opts.sortOrder ?? 0,
        encryptedData: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteGroupsTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(groupMemberships).run();
    db.delete(groups).run();
  });

  describe("groups", () => {
    it("round-trips all fields including sortOrder, encryptedData, timestamps, and version", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<GroupId>(crypto.randomUUID());
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      db.insert(groups)
        .values({
          id,
          systemId,
          parentGroupId: null,
          sortOrder: 5,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(groups).where(eq(groups.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(id);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.parentGroupId).toBeNull();
      expect(rows[0]?.sortOrder).toBe(5);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.updatedAt).toBe(now);
      expect(rows[0]?.version).toBe(1);
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<GroupId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(groups)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(groups).where(eq(groups.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("sets parentGroupId to NULL on parent group delete (self-referential FK SET NULL)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const parentId = insertGroup(systemId);
      const childId = insertGroup(systemId, { parentGroupId: parentId });

      // Verify the child references the parent
      const before = db.select().from(groups).where(eq(groups.id, childId)).all();
      expect(before[0]?.parentGroupId).toBe(parentId);

      // Delete parent group
      db.delete(groups).where(eq(groups.id, parentId)).run();

      // Child should still exist with parentGroupId set to NULL
      const after = db.select().from(groups).where(eq(groups.id, childId)).all();
      expect(after).toHaveLength(1);
      expect(after[0]?.parentGroupId).toBeNull();
    });

    it("rejects negative sort_order via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(groups)
          .values({
            id: brandId<GroupId>(crypto.randomUUID()),
            systemId,
            sortOrder: -1,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow(/CHECK|constraint/i);
    });

    it("supports archivable fields with defaults and update", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<GroupId>(crypto.randomUUID());
      const now = Date.now();

      db.insert(groups)
        .values({
          id,
          systemId,
          sortOrder: 0,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Default: archived = false, archivedAt = null
      const before = db.select().from(groups).where(eq(groups.id, id)).all();
      expect(before[0]?.archived).toBe(false);
      expect(before[0]?.archivedAt).toBeNull();

      // Update to archived
      const archivedAt = Date.now();
      db.update(groups).set({ archived: true, archivedAt }).where(eq(groups.id, id)).run();

      const after = db.select().from(groups).where(eq(groups.id, id)).all();
      expect(after[0]?.archived).toBe(true);
      expect(after[0]?.archivedAt).toBe(archivedAt);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const groupId = insertGroup(systemId);

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(groups).where(eq(groups.id, groupId)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO groups (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 0, X'0102', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            "INSERT INTO groups (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, 0, X'0102', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });
  });

  describe("group_memberships", () => {
    it("round-trips composite PK (groupId, memberId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const groupId = insertGroup(systemId);
      const now = Date.now();

      db.insert(groupMemberships)
        .values({
          groupId,
          memberId,
          systemId,
          createdAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.memberId, memberId)))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.groupId).toBe(groupId);
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.createdAt).toBe(now);
    });

    it("cascades on group deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const groupId = insertGroup(systemId);
      const now = Date.now();

      db.insert(groupMemberships)
        .values({
          groupId,
          memberId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(groups).where(eq(groups.id, groupId)).run();

      const rows = db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.memberId, memberId)))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on member deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const groupId = insertGroup(systemId);
      const now = Date.now();

      db.insert(groupMemberships)
        .values({
          groupId,
          memberId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(members).where(eq(members.id, memberId)).run();

      const rows = db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.memberId, memberId)))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects duplicate composite PK (same groupId + memberId)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const groupId = insertGroup(systemId);
      const now = Date.now();

      db.insert(groupMemberships)
        .values({
          groupId,
          memberId,
          systemId,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(groupMemberships)
          .values({
            groupId,
            memberId,
            systemId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|PRIMARY KEY|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const groupId = insertGroup(systemId);
      const now = Date.now();

      db.insert(groupMemberships)
        .values({
          groupId,
          memberId,
          systemId,
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();

      const rows = db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.memberId, memberId)))
        .all();
      expect(rows).toHaveLength(0);
    });
  });
});
