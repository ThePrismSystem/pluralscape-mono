import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { pgCleanupSyncedEntries } from "../queries/sync-queue-cleanup.js";
import { accounts } from "../schema/pg/auth.js";
import { syncQueue } from "../schema/pg/sync.js";
import { systems } from "../schema/pg/systems.js";

import { createPgSyncTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, syncQueue };

describe("pgCleanupSyncedEntries", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSyncTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(syncQueue);
  });

  async function insertSyncEntry(
    systemId: string,
    opts: { syncedAt?: number | null },
  ): Promise<string> {
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
      syncedAt: opts.syncedAt ?? null,
    });
    return id;
  }

  it("deletes synced entries older than threshold", async () => {
    const accountId = await pgInsertAccount(db);
    const systemId = await pgInsertSystem(db, accountId);

    // Insert a synced entry, then backdate it via raw SQL
    const oldId = await insertSyncEntry(systemId, { syncedAt: Date.now() });
    await db.execute(
      sql`UPDATE sync_queue SET synced_at = now() - interval '10 days' WHERE id = ${oldId}`,
    );

    // Insert a recently synced entry
    const recentId = await insertSyncEntry(systemId, { syncedAt: Date.now() });

    // Insert an unsynced entry
    const unsyncedId = await insertSyncEntry(systemId, { syncedAt: null });

    const result = await pgCleanupSyncedEntries(db, { olderThanDays: 7 });
    expect(result.deletedCount).toBe(1);

    // Verify: old synced entry is gone
    const remaining = await db.select().from(syncQueue);
    const remainingIds = remaining.map((r) => r.id);
    expect(remainingIds).not.toContain(oldId);
    expect(remainingIds).toContain(recentId);
    expect(remainingIds).toContain(unsyncedId);
  });

  it("returns 0 when nothing to clean", async () => {
    const result = await pgCleanupSyncedEntries(db, { olderThanDays: 7 });
    expect(result.deletedCount).toBe(0);
  });

  it("does not delete unsynced entries", async () => {
    const accountId = await pgInsertAccount(db);
    const systemId = await pgInsertSystem(db, accountId);

    await insertSyncEntry(systemId, { syncedAt: null });
    await insertSyncEntry(systemId, { syncedAt: null });

    const result = await pgCleanupSyncedEntries(db, { olderThanDays: 0 });
    expect(result.deletedCount).toBe(0);

    const remaining = await db.select().from(syncQueue);
    expect(remaining).toHaveLength(2);
  });
});
