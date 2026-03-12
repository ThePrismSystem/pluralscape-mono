import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { syncConflicts, syncDocuments, syncQueue } from "../schema/sqlite/sync.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteSyncTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, syncDocuments, syncQueue, syncConflicts };

describe("SQLite sync schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteSyncTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(syncConflicts).run();
    db.delete(syncQueue).run();
    db.delete(syncDocuments).run();
  });

  describe("sync_documents", () => {
    it("round-trips with all fields including binary automergeHeads", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const heads = new Uint8Array([10, 20, 30, 40]);

      db.insert(syncDocuments)
        .values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          automergeHeads: heads,
          version: 3,
          createdAt: now,
          lastSyncedAt: now + 1000,
        })
        .run();

      const rows = db.select().from(syncDocuments).where(eq(syncDocuments.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.automergeHeads).toEqual(heads);
      expect(rows[0]?.version).toBe(3);
      expect(rows[0]?.lastSyncedAt).toBe(now + 1000);
    });

    it("defaults version to 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncDocuments)
        .values({
          id,
          systemId,
          entityType: "group",
          entityId: crypto.randomUUID(),
          createdAt: now,
        })
        .run();

      const rows = db.select().from(syncDocuments).where(eq(syncDocuments.id, id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("allows nullable automergeHeads and lastSyncedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncDocuments)
        .values({
          id,
          systemId,
          entityType: "note",
          entityId: crypto.randomUUID(),
          createdAt: now,
        })
        .run();

      const rows = db.select().from(syncDocuments).where(eq(syncDocuments.id, id)).all();
      expect(rows[0]?.automergeHeads).toBeNull();
      expect(rows[0]?.lastSyncedAt).toBeNull();
    });

    it("rejects version less than 1", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(syncDocuments)
          .values({
            id: crypto.randomUUID(),
            systemId,
            entityType: "member",
            entityId: crypto.randomUUID(),
            version: 0,
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects duplicate (system_id, entity_type, entity_id)", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const entityId = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncDocuments)
        .values({
          id: crypto.randomUUID(),
          systemId,
          entityType: "member",
          entityId,
          createdAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(syncDocuments)
          .values({
            id: crypto.randomUUID(),
            systemId,
            entityType: "member",
            entityId,
            createdAt: now,
          })
          .run(),
      ).toThrow(/UNIQUE|constraint/i);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncDocuments)
        .values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(syncDocuments).where(eq(syncDocuments.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("sync_queue", () => {
    it("round-trips with all fields including binary changeData", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([1, 2, 3, 4, 5]);

      db.insert(syncQueue)
        .values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          operation: "create",
          changeData: data,
          createdAt: now,
          syncedAt: now + 5000,
        })
        .run();

      const rows = db.select().from(syncQueue).where(eq(syncQueue.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.operation).toBe("create");
      expect(rows[0]?.changeData).toEqual(data);
      expect(rows[0]?.syncedAt).toBe(now + 5000);
    });

    it("allows nullable syncedAt", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncQueue)
        .values({
          id,
          systemId,
          entityType: "group",
          entityId: crypto.randomUUID(),
          operation: "update",
          changeData: new Uint8Array([10]),
          createdAt: now,
        })
        .run();

      const rows = db.select().from(syncQueue).where(eq(syncQueue.id, id)).all();
      expect(rows[0]?.syncedAt).toBeNull();
    });

    it("rejects invalid operation", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(syncQueue)
          .values({
            id: crypto.randomUUID(),
            systemId,
            entityType: "member",
            entityId: crypto.randomUUID(),
            operation: "invalid" as "create",
            changeData: new Uint8Array([1]),
            createdAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("supports lifecycle: insert unsynced then mark synced", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncQueue)
        .values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          operation: "create",
          changeData: new Uint8Array([1, 2, 3]),
          createdAt: now,
        })
        .run();

      const before = db.select().from(syncQueue).where(eq(syncQueue.id, id)).all();
      expect(before[0]?.syncedAt).toBeNull();

      const syncedAt = now + 5000;
      db.update(syncQueue).set({ syncedAt }).where(eq(syncQueue.id, id)).run();

      const after = db.select().from(syncQueue).where(eq(syncQueue.id, id)).all();
      expect(after[0]?.syncedAt).toBe(syncedAt);
    });

    it("round-trips binary changeData accurately", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([0, 127, 128, 255]);

      db.insert(syncQueue)
        .values({
          id,
          systemId,
          entityType: "note",
          entityId: crypto.randomUUID(),
          operation: "delete",
          changeData: data,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(syncQueue).where(eq(syncQueue.id, id)).all();
      expect(rows[0]?.changeData).toEqual(data);
    });
  });

  describe("sync_conflicts", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncConflicts)
        .values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          localVersion: 3,
          remoteVersion: 5,
          resolution: "merged",
          createdAt: now,
          resolvedAt: now + 2000,
          details: "auto-merged field changes",
        })
        .run();

      const rows = db.select().from(syncConflicts).where(eq(syncConflicts.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.entityType).toBe("member");
      expect(rows[0]?.localVersion).toBe(3);
      expect(rows[0]?.remoteVersion).toBe(5);
      expect(rows[0]?.resolution).toBe("merged");
      expect(rows[0]?.resolvedAt).toBe(now + 2000);
      expect(rows[0]?.details).toBe("auto-merged field changes");
    });

    it("allows nullable resolution for unresolved conflicts", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncConflicts)
        .values({
          id,
          systemId,
          entityType: "group",
          entityId: crypto.randomUUID(),
          localVersion: 1,
          remoteVersion: 2,
          createdAt: now,
        })
        .run();

      const rows = db.select().from(syncConflicts).where(eq(syncConflicts.id, id)).all();
      expect(rows[0]?.resolution).toBeNull();
      expect(rows[0]?.resolvedAt).toBeNull();
      expect(rows[0]?.details).toBeNull();
    });

    it("rejects invalid resolution", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(syncConflicts)
          .values({
            id: crypto.randomUUID(),
            systemId,
            entityType: "member",
            entityId: crypto.randomUUID(),
            localVersion: 1,
            remoteVersion: 2,
            resolution: "invalid" as "local",
            createdAt: now,
            resolvedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects resolution set with resolvedAt null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO sync_conflicts (id, system_id, entity_type, entity_id, local_version, remote_version, resolution, created_at) VALUES (?, ?, 'member', ?, 1, 2, 'local', ?)`,
          )
          .run(crypto.randomUUID(), systemId, crypto.randomUUID(), now),
      ).toThrow(/constraint/i);
    });

    it("rejects resolvedAt set with resolution null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        client
          .prepare(
            `INSERT INTO sync_conflicts (id, system_id, entity_type, entity_id, local_version, remote_version, created_at, resolved_at) VALUES (?, ?, 'member', ?, 1, 2, ?, ?)`,
          )
          .run(crypto.randomUUID(), systemId, crypto.randomUUID(), now, now),
      ).toThrow(/constraint/i);
    });

    it.each(["local", "remote"] as const)("exercises %s resolution", (resolution) => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncConflicts)
        .values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          localVersion: 1,
          remoteVersion: 2,
          resolution,
          createdAt: now,
          resolvedAt: now,
        })
        .run();

      const rows = db.select().from(syncConflicts).where(eq(syncConflicts.id, id)).all();
      expect(rows[0]?.resolution).toBe(resolution);
    });

    it("supports conflict lifecycle: insert unresolved then resolve", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncConflicts)
        .values({
          id,
          systemId,
          entityType: "member",
          entityId: crypto.randomUUID(),
          localVersion: 3,
          remoteVersion: 4,
          createdAt: now,
        })
        .run();

      const before = db.select().from(syncConflicts).where(eq(syncConflicts.id, id)).all();
      expect(before[0]?.resolution).toBeNull();
      expect(before[0]?.resolvedAt).toBeNull();

      const resolvedAt = now + 5000;
      db.update(syncConflicts)
        .set({ resolution: "local", resolvedAt })
        .where(eq(syncConflicts.id, id))
        .run();

      const after = db.select().from(syncConflicts).where(eq(syncConflicts.id, id)).all();
      expect(after[0]?.resolution).toBe("local");
      expect(after[0]?.resolvedAt).toBe(resolvedAt);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(syncConflicts)
        .values({
          id,
          systemId,
          entityType: "note",
          entityId: crypto.randomUUID(),
          localVersion: 1,
          remoteVersion: 2,
          createdAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(syncConflicts).where(eq(syncConflicts.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });
});
