import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { syncConflicts, syncDocuments, syncQueue } from "../schema/pg/sync.js";
import { systems } from "../schema/pg/systems.js";

import { createPgSyncTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, syncDocuments, syncQueue, syncConflicts };

describe("PG sync schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSyncTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("sync_documents", () => {
    it("round-trips all fields including binary automergeHeads", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const heads = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

      await db.insert(syncDocuments).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        automergeHeads: heads,
        version: 3,
        createdAt: now,
        lastSyncedAt: now,
      });

      const rows = await db.select().from(syncDocuments).where(eq(syncDocuments.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.automergeHeads).toEqual(heads);
      expect(rows[0]?.version).toBe(3);
      expect(rows[0]?.lastSyncedAt).toBe(now);
    });

    it("defaults version to 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncDocuments).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        createdAt: now,
      });

      const rows = await db.select().from(syncDocuments).where(eq(syncDocuments.id, id));
      expect(rows[0]?.version).toBe(1);
    });

    it("enforces unique (system_id, entity_type, entity_id)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const entityId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncDocuments).values({
        id: crypto.randomUUID(),
        systemId,
        entityType: "member",
        entityId,
        createdAt: now,
      });

      await expect(
        db.insert(syncDocuments).values({
          id: crypto.randomUUID(),
          systemId,
          entityType: "member",
          entityId,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows nullable automergeHeads and lastSyncedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncDocuments).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        createdAt: now,
      });

      const rows = await db.select().from(syncDocuments).where(eq(syncDocuments.id, id));
      expect(rows[0]?.automergeHeads).toBeNull();
      expect(rows[0]?.lastSyncedAt).toBeNull();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncDocuments).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(syncDocuments).where(eq(syncDocuments.id, id));
      expect(rows).toHaveLength(0);
    });
  });

  describe("sync_queue", () => {
    it("round-trips all fields including binary changeData", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      await db.insert(syncQueue).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        operation: "create",
        changeData: data,
        createdAt: now,
        syncedAt: now,
      });

      const rows = await db.select().from(syncQueue).where(eq(syncQueue.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.operation).toBe("create");
      expect(rows[0]?.changeData).toEqual(data);
      expect(rows[0]?.syncedAt).toBe(now);
    });

    it("rejects invalid operation", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(syncQueue).values({
          id: crypto.randomUUID(),
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          operation: "invalid" as "create",
          changeData: new Uint8Array([1]),
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("exercises update operation", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncQueue).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        operation: "update",
        changeData: new Uint8Array([10]),
        createdAt: now,
      });

      const rows = await db.select().from(syncQueue).where(eq(syncQueue.id, id));
      expect(rows[0]?.operation).toBe("update");
    });

    it("exercises delete operation", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncQueue).values({
        id,
        systemId,
        entityType: "group",
        entityId: crypto.randomUUID(),
        operation: "delete",
        changeData: new Uint8Array([20]),
        createdAt: now,
      });

      const rows = await db.select().from(syncQueue).where(eq(syncQueue.id, id));
      expect(rows[0]?.operation).toBe("delete");
    });

    it("allows nullable syncedAt", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncQueue).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        operation: "update",
        changeData: new Uint8Array([10]),
        createdAt: now,
      });

      const rows = await db.select().from(syncQueue).where(eq(syncQueue.id, id));
      expect(rows[0]?.syncedAt).toBeNull();
    });

    it("round-trips binary changeData content", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([0xff, 0x00, 0xab, 0xcd, 0xef]);

      await db.insert(syncQueue).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        operation: "delete",
        changeData: data,
        createdAt: now,
      });

      const rows = await db.select().from(syncQueue).where(eq(syncQueue.id, id));
      expect(rows[0]?.changeData).toBeInstanceOf(Uint8Array);
      expect(rows[0]?.changeData).toEqual(data);
    });
  });

  describe("sync_conflicts", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncConflicts).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        localVersion: 5,
        remoteVersion: 7,
        resolution: "merged",
        createdAt: now,
        resolvedAt: now,
        details: "auto-merged field changes",
      });

      const rows = await db.select().from(syncConflicts).where(eq(syncConflicts.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.localVersion).toBe(5);
      expect(rows[0]?.remoteVersion).toBe(7);
      expect(rows[0]?.resolution).toBe("merged");
      expect(rows[0]?.resolvedAt).toBe(now);
      expect(rows[0]?.details).toBe("auto-merged field changes");
    });

    it("exercises local resolution", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncConflicts).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        localVersion: 1,
        remoteVersion: 2,
        resolution: "local",
        createdAt: now,
        resolvedAt: now,
      });

      const rows = await db.select().from(syncConflicts).where(eq(syncConflicts.id, id));
      expect(rows[0]?.resolution).toBe("local");
    });

    it("exercises remote resolution", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncConflicts).values({
        id,
        systemId,
        entityType: "group",
        entityId: crypto.randomUUID(),
        localVersion: 3,
        remoteVersion: 4,
        resolution: "remote",
        createdAt: now,
        resolvedAt: now,
      });

      const rows = await db.select().from(syncConflicts).where(eq(syncConflicts.id, id));
      expect(rows[0]?.resolution).toBe("remote");
    });

    it("allows nullable resolution", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncConflicts).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        localVersion: 1,
        remoteVersion: 2,
        createdAt: now,
      });

      const rows = await db.select().from(syncConflicts).where(eq(syncConflicts.id, id));
      expect(rows[0]?.resolution).toBeNull();
      expect(rows[0]?.resolvedAt).toBeNull();
    });

    it("rejects invalid resolution", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(syncConflicts).values({
          id: crypto.randomUUID(),
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          localVersion: 1,
          remoteVersion: 2,
          resolution: "invalid" as "local",
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("supports conflict lifecycle: insert unresolved then resolve", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncConflicts).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        localVersion: 3,
        remoteVersion: 4,
        createdAt: now,
      });

      const before = await db.select().from(syncConflicts).where(eq(syncConflicts.id, id));
      expect(before[0]?.resolution).toBeNull();
      expect(before[0]?.resolvedAt).toBeNull();

      const resolvedAt = now + 5000;
      await db
        .update(syncConflicts)
        .set({ resolution: "local", resolvedAt })
        .where(eq(syncConflicts.id, id));

      const after = await db.select().from(syncConflicts).where(eq(syncConflicts.id, id));
      expect(after[0]?.resolution).toBe("local");
      expect(after[0]?.resolvedAt).toBe(resolvedAt);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncConflicts).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        localVersion: 1,
        remoteVersion: 2,
        createdAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(syncConflicts).where(eq(syncConflicts.id, id));
      expect(rows).toHaveLength(0);
    });
  });
});
