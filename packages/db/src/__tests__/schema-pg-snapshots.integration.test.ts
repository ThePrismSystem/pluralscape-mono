import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { systemSnapshots } from "../schema/pg/snapshots.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgSnapshotTables,
  pgInsertAccount,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { systems, systemSnapshots };

describe("PG system_snapshots schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgSnapshotTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("round-trips insert and select", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = crypto.randomUUID();
    const now = Date.now();

    await db.insert(systemSnapshots).values({
      id,
      systemId,
      snapshotTrigger: "manual",
      encryptedData: testBlob(),
      createdAt: now,
    });

    const rows = await db.select().from(systemSnapshots).where(eq(systemSnapshots.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.snapshotTrigger).toBe("manual");
    expect(rows[0]?.systemId).toBe(systemId);
  });

  it("accepts scheduled-daily trigger", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = crypto.randomUUID();

    await db.insert(systemSnapshots).values({
      id,
      systemId,
      snapshotTrigger: "scheduled-daily",
      encryptedData: testBlob(),
      createdAt: Date.now(),
    });

    const rows = await db.select().from(systemSnapshots).where(eq(systemSnapshots.id, id));
    expect(rows[0]?.snapshotTrigger).toBe("scheduled-daily");
  });

  it("accepts scheduled-weekly trigger", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = crypto.randomUUID();

    await db.insert(systemSnapshots).values({
      id,
      systemId,
      snapshotTrigger: "scheduled-weekly",
      encryptedData: testBlob(),
      createdAt: Date.now(),
    });

    const rows = await db.select().from(systemSnapshots).where(eq(systemSnapshots.id, id));
    expect(rows[0]?.snapshotTrigger).toBe("scheduled-weekly");
  });

  it("rejects invalid snapshot_trigger values", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);

    await expect(
      db.insert(systemSnapshots).values({
        id: crypto.randomUUID(),
        systemId,
        snapshotTrigger: "invalid" as "manual",
        encryptedData: testBlob(),
        createdAt: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("cascades on system deletion", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const id = crypto.randomUUID();

    await db.insert(systemSnapshots).values({
      id,
      systemId,
      snapshotTrigger: "manual",
      encryptedData: testBlob(),
      createdAt: Date.now(),
    });

    await db.delete(systems).where(eq(systems.id, systemId));
    const rows = await db.select().from(systemSnapshots).where(eq(systemSnapshots.id, id));
    expect(rows).toHaveLength(0);
  });

  it("supports index query by system_id and created_at", async () => {
    const accountId = await insertAccount();
    const systemId = await insertSystem(accountId);
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      await db.insert(systemSnapshots).values({
        id: crypto.randomUUID(),
        systemId,
        snapshotTrigger: "manual",
        encryptedData: testBlob(),
        createdAt: now + i * 1000,
      });
    }

    const rows = await db
      .select()
      .from(systemSnapshots)
      .where(eq(systemSnapshots.systemId, systemId));
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
