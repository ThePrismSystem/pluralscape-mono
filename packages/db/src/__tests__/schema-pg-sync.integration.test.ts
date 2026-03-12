import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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

  afterEach(async () => {
    await db.delete(syncConflicts);
    await db.delete(syncQueue);
    await db.delete(syncDocuments);
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

    it("rejects version less than 1", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(syncDocuments).values({
          id: crypto.randomUUID(),
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          version: 0,
          createdAt: now,
        }),
      ).rejects.toThrow();
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

    it.each(["update", "delete"] as const)("exercises %s operation", async (operation) => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncQueue).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        operation,
        changeData: new Uint8Array([10]),
        createdAt: now,
      });

      const rows = await db.select().from(syncQueue).where(eq(syncQueue.id, id));
      expect(rows[0]?.operation).toBe(operation);
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

    it("supports lifecycle: insert unsynced then mark synced", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(syncQueue).values({
        id,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        operation: "create",
        changeData: new Uint8Array([1, 2, 3]),
        createdAt: now,
      });

      const before = await db.select().from(syncQueue).where(eq(syncQueue.id, id));
      expect(before[0]?.syncedAt).toBeNull();

      const syncedAt = now + 5000;
      await db.update(syncQueue).set({ syncedAt }).where(eq(syncQueue.id, id));

      const after = await db.select().from(syncQueue).where(eq(syncQueue.id, id));
      expect(after[0]?.syncedAt).toBe(syncedAt);
    });

    it("auto-assigns monotonically increasing seq values", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();
      const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

      for (const id of ids) {
        await db.insert(syncQueue).values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          operation: "create",
          changeData: new Uint8Array([1]),
          createdAt: now,
        });
      }

      const rows = await Promise.all(
        ids.map((id) =>
          db
            .select()
            .from(syncQueue)
            .where(eq(syncQueue.id, id))
            .then((r) => r[0]),
        ),
      );

      const seqs = rows.map((r) => r?.seq);
      expect(seqs[0]).toBeDefined();
      expect(seqs[1]).toBeDefined();
      expect(seqs[2]).toBeDefined();
      const [s0, s1, s2] = seqs as [number, number, number];
      expect(s0).toBeLessThan(s1);
      expect(s1).toBeLessThan(s2);
    });

    it("orders replay correctly via seq column", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      const id3 = crypto.randomUUID();

      for (const id of [id1, id2, id3]) {
        await db.insert(syncQueue).values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          operation: "create",
          changeData: new Uint8Array([1]),
          createdAt: now,
        });
      }

      const rows = await db
        .select()
        .from(syncQueue)
        .where(eq(syncQueue.systemId, systemId))
        .orderBy(syncQueue.seq);

      expect(rows.map((r) => r.id)).toEqual([id1, id2, id3]);
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

    it.each(["local", "remote"] as const)("exercises %s resolution", async (resolution) => {
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
        resolution,
        createdAt: now,
        resolvedAt: now,
      });

      const rows = await db.select().from(syncConflicts).where(eq(syncConflicts.id, id));
      expect(rows[0]?.resolution).toBe(resolution);
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
          resolvedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects resolution set with resolvedAt null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          `INSERT INTO sync_conflicts (id, system_id, entity_type, entity_id, local_version, remote_version, resolution, created_at) VALUES ($1, $2, 'member', $3, 1, 2, 'local', $4)`,
          [crypto.randomUUID(), systemId, crypto.randomUUID(), now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects resolvedAt set with resolution null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        client.query(
          `INSERT INTO sync_conflicts (id, system_id, entity_type, entity_id, local_version, remote_version, created_at, resolved_at) VALUES ($1, $2, 'member', $3, 1, 2, $4, $5)`,
          [crypto.randomUUID(), systemId, crypto.randomUUID(), now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
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
