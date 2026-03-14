import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { groupMemberships, groups } from "../schema/pg/groups.js";
import { members } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgGroupsTables,
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
  groups,
  groupMemberships,
};

describe("PG groups schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => pgInsertMember(db, systemId, id);

  async function insertGroup(
    systemId: string,
    opts: { parentGroupId?: string | null; sortOrder?: number } = {},
    id = crypto.randomUUID(),
  ): Promise<string> {
    const now = Date.now();
    await db.insert(groups).values({
      id,
      systemId,
      parentGroupId: opts.parentGroupId ?? null,
      sortOrder: opts.sortOrder ?? 0,
      encryptedData: testBlob(),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function insertGroupMembership(
    groupId: string,
    memberId: string,
    systemId: string,
  ): Promise<void> {
    const now = Date.now();
    await db.insert(groupMemberships).values({
      groupId,
      memberId,
      systemId,
      createdAt: now,
    });
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgGroupsTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(groupMemberships);
    await db.delete(groups);
  });

  // ── groups ──────────────────────────────────────────────────────────

  describe("groups", () => {
    it("round-trips insert and select with all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30, 40, 50]));

      await db.insert(groups).values({
        id,
        systemId,
        parentGroupId: null,
        sortOrder: 5,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
        version: 3,
        archived: false,
        archivedAt: null,
      });

      const rows = await db.select().from(groups).where(eq(groups.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(id);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.parentGroupId).toBeNull();
      expect(rows[0]?.sortOrder).toBe(5);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.updatedAt).toBe(now);
      expect(rows[0]?.version).toBe(3);
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("self-ref FK sets parentGroupId to null on parent delete", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const parentId = await insertGroup(systemId);
      const childId = await insertGroup(systemId, { parentGroupId: parentId });

      // verify child references parent
      let rows = await db.select().from(groups).where(eq(groups.id, childId));
      expect(rows[0]?.parentGroupId).toBe(parentId);

      // delete parent
      await db.delete(groups).where(eq(groups.id, parentId));

      // child still exists, parentGroupId is null
      rows = await db.select().from(groups).where(eq(groups.id, childId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.parentGroupId).toBeNull();
    });

    it("rejects negative sort_order via CHECK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(groups).values({
          id: crypto.randomUUID(),
          systemId,
          sortOrder: -1,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("defaults archived to false, archivedAt to null, and version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(groups).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(groups).where(eq(groups.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
      expect(rows[0]?.version).toBe(1);
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(groups).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(groups).where(eq(groups.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(groups).values({
        id,
        systemId,
        sortOrder: 0,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const archiveTime = Date.now();
      await db
        .update(groups)
        .set({ archived: true, archivedAt: archiveTime })
        .where(eq(groups.id, id));

      const rows = await db.select().from(groups).where(eq(groups.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(archiveTime);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const groupId = await insertGroup(systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(groups).where(eq(groups.id, groupId));
      expect(rows).toHaveLength(0);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          "INSERT INTO groups (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 0, '\\x0102'::bytea, $3, $4, 1, true, NULL)",
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
          "INSERT INTO groups (id, system_id, sort_order, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, 0, '\\x0102'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  // ── group_memberships ───────────────────────────────────────────────

  describe("group_memberships", () => {
    it("round-trips insert and select with composite PK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const groupId = await insertGroup(systemId);
      const memberId = await insertMember(systemId);
      const now = Date.now();

      await db.insert(groupMemberships).values({
        groupId,
        memberId,
        systemId,
        createdAt: now,
      });

      const rows = await db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.memberId, memberId)));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.groupId).toBe(groupId);
      expect(rows[0]?.memberId).toBe(memberId);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.createdAt).toBe(now);
    });

    it("cascades on group deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const groupId = await insertGroup(systemId);
      const memberId = await insertMember(systemId);

      await insertGroupMembership(groupId, memberId, systemId);

      await db.delete(groups).where(eq(groups.id, groupId));
      const rows = await db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.memberId, memberId)));
      expect(rows).toHaveLength(0);
    });

    it("cascades on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const groupId = await insertGroup(systemId);
      const memberId = await insertMember(systemId);

      await insertGroupMembership(groupId, memberId, systemId);

      await client.query("DELETE FROM members WHERE id = $1", [memberId]);
      const rows = await db
        .select()
        .from(groupMemberships)
        .where(and(eq(groupMemberships.groupId, groupId), eq(groupMemberships.memberId, memberId)));
      expect(rows).toHaveLength(0);
    });

    it("rejects duplicate groupId+memberId pair", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const groupId = await insertGroup(systemId);
      const memberId = await insertMember(systemId);
      const now = Date.now();

      await db.insert(groupMemberships).values({
        groupId,
        memberId,
        systemId,
        createdAt: now,
      });

      await expect(
        db.insert(groupMemberships).values({
          groupId,
          memberId,
          systemId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const groupId = await insertGroup(systemId);
      const memberId = await insertMember(systemId);

      await insertGroupMembership(groupId, memberId, systemId);

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db
        .select()
        .from(groupMemberships)
        .where(eq(groupMemberships.systemId, systemId));
      expect(rows).toHaveLength(0);
    });
  });
});
