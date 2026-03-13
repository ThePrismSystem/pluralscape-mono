import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { sqliteCleanupSyncedEntries } from "../queries/sync-queue-cleanup.js";
import { accounts } from "../schema/sqlite/auth.js";
import { syncQueue } from "../schema/sqlite/sync.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteSyncTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, syncQueue };

describe("sqliteCleanupSyncedEntries", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;
  let seqCounter = 1;

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
    db.delete(syncQueue).run();
  });

  function insertSyncEntry(systemId: string, opts: { syncedAt?: number | null }): string {
    const id = crypto.randomUUID();
    const now = Date.now();
    db.insert(syncQueue)
      .values({
        id,
        seq: seqCounter++,
        systemId,
        entityType: "member",
        entityId: crypto.randomUUID(),
        operation: "create",
        changeData: new Uint8Array([1, 2, 3]),
        createdAt: now,
        syncedAt: opts.syncedAt ?? null,
      })
      .run();
    return id;
  }

  it("deletes synced entries older than threshold", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);

    const tenDaysAgoMs = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const oldId = insertSyncEntry(systemId, { syncedAt: tenDaysAgoMs });
    const recentId = insertSyncEntry(systemId, { syncedAt: Date.now() });
    const unsyncedId = insertSyncEntry(systemId, { syncedAt: null });

    const result = sqliteCleanupSyncedEntries(db, { olderThanDays: 7 });
    expect(result.deletedCount).toBe(1);

    const remaining = db.select().from(syncQueue).all();
    const remainingIds = remaining.map((r) => r.id);
    expect(remainingIds).not.toContain(oldId);
    expect(remainingIds).toContain(recentId);
    expect(remainingIds).toContain(unsyncedId);
  });

  it("returns 0 when nothing to clean", () => {
    const result = sqliteCleanupSyncedEntries(db, { olderThanDays: 7 });
    expect(result.deletedCount).toBe(0);
  });

  it("does not delete unsynced entries", () => {
    const accountId = sqliteInsertAccount(db);
    const systemId = sqliteInsertSystem(db, accountId);

    insertSyncEntry(systemId, { syncedAt: null });
    insertSyncEntry(systemId, { syncedAt: null });

    const result = sqliteCleanupSyncedEntries(db, { olderThanDays: 0 });
    expect(result.deletedCount).toBe(0);

    const remaining = db.select().from(syncQueue).all();
    expect(remaining).toHaveLength(2);
  });
});
