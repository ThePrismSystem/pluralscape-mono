import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { systemSnapshots } from "../schema/sqlite/snapshots.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteSnapshotTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { SystemSnapshotId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { systems, systemSnapshots };

describe("SQLite system_snapshots schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteSnapshotTables(client);
  });

  afterEach(() => {
    client.exec("DELETE FROM system_snapshots");
    client.exec("DELETE FROM systems");
    client.exec("DELETE FROM accounts");
  });

  afterAll(() => {
    client.close();
  });

  it("round-trips insert and select", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<SystemSnapshotId>(crypto.randomUUID());
    const now = fixtureNow();

    db.insert(systemSnapshots)
      .values({
        id,
        systemId,
        snapshotTrigger: "manual",
        encryptedData: testBlob(),
        createdAt: now,
      })
      .run();

    const rows = db.select().from(systemSnapshots).where(eq(systemSnapshots.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.snapshotTrigger).toBe("manual");
    expect(rows[0]?.systemId).toBe(systemId);
  });

  it("accepts scheduled-daily trigger", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<SystemSnapshotId>(crypto.randomUUID());

    db.insert(systemSnapshots)
      .values({
        id,
        systemId,
        snapshotTrigger: "scheduled-daily",
        encryptedData: testBlob(),
        createdAt: fixtureNow(),
      })
      .run();

    const rows = db.select().from(systemSnapshots).where(eq(systemSnapshots.id, id)).all();
    expect(rows[0]?.snapshotTrigger).toBe("scheduled-daily");
  });

  it("accepts scheduled-weekly trigger", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<SystemSnapshotId>(crypto.randomUUID());

    db.insert(systemSnapshots)
      .values({
        id,
        systemId,
        snapshotTrigger: "scheduled-weekly",
        encryptedData: testBlob(),
        createdAt: fixtureNow(),
      })
      .run();

    const rows = db.select().from(systemSnapshots).where(eq(systemSnapshots.id, id)).all();
    expect(rows[0]?.snapshotTrigger).toBe("scheduled-weekly");
  });

  it("rejects invalid snapshot_trigger values", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);

    expect(() =>
      db
        .insert(systemSnapshots)
        .values({
          id: brandId<SystemSnapshotId>(crypto.randomUUID()),
          systemId,
          snapshotTrigger: "invalid" as "manual",
          encryptedData: testBlob(),
          createdAt: fixtureNow(),
        })
        .run(),
    ).toThrow();
  });

  it("cascades on system deletion", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const id = brandId<SystemSnapshotId>(crypto.randomUUID());

    db.insert(systemSnapshots)
      .values({
        id,
        systemId,
        snapshotTrigger: "manual",
        encryptedData: testBlob(),
        createdAt: fixtureNow(),
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db.select().from(systemSnapshots).where(eq(systemSnapshots.id, id)).all();
    expect(rows).toHaveLength(0);
  });

  it("supports multiple snapshots per system", () => {
    const accountId = insertAccount();
    const systemId = insertSystem(accountId);
    const now = fixtureNow();

    for (let i = 0; i < 3; i++) {
      db.insert(systemSnapshots)
        .values({
          id: brandId<SystemSnapshotId>(crypto.randomUUID()),
          systemId,
          snapshotTrigger: "manual",
          encryptedData: testBlob(),
          createdAt: toUnixMillis(now + i * 1000),
        })
        .run();
    }

    const rows = db
      .select()
      .from(systemSnapshots)
      .where(eq(systemSnapshots.systemId, systemId))
      .all();
    expect(rows).toHaveLength(3);
  });
});
