import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { systemSettings } from "../schema/sqlite/system-settings.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteSystemSettingsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, systemSettings };

describe("SQLite system_settings schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteSystemSettingsTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves with all columns", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const data = testBlob(new Uint8Array([10, 20, 30]));

    db.insert(systemSettings)
      .values({
        id: `sset_${crypto.randomUUID()}`,
        systemId,
        locale: "en-US",
        pinHash: "$argon2id$test-hash",
        biometricEnabled: true,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.locale).toBe("en-US");
    expect(rows[0]?.pinHash).toBe("$argon2id$test-hash");
    expect(rows[0]?.biometricEnabled).toBe(true);
    expect(rows[0]?.encryptedData).toEqual(data);
  });

  it("defaults boolean fields to false", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(systemSettings)
      .values({
        id: `sset_${crypto.randomUUID()}`,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .all();
    expect(rows[0]?.biometricEnabled).toBe(false);
  });

  it("allows nullable locale and pinHash", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(systemSettings)
      .values({
        id: `sset_${crypto.randomUUID()}`,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .all();
    expect(rows[0]?.locale).toBeNull();
    expect(rows[0]?.pinHash).toBeNull();
  });

  it("defaults version to 1", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(systemSettings)
      .values({
        id: `sset_${crypto.randomUUID()}`,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .all();
    expect(rows[0]?.version).toBe(1);
  });

  it("enforces 1:1 with systems (rejects duplicate systemId)", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(systemSettings)
      .values({
        id: `sset_${crypto.randomUUID()}`,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(() =>
      db
        .insert(systemSettings)
        .values({
          id: `sset_${crypto.randomUUID()}`,
          systemId,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow(/UNIQUE|constraint/i);
  });

  it("cascades on system deletion", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(systemSettings)
      .values({
        id: `sset_${crypto.randomUUID()}`,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .all();
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent systemId FK", () => {
    const now = Date.now();
    expect(() =>
      db
        .insert(systemSettings)
        .values({
          id: `sset_${crypto.randomUUID()}`,
          systemId: "nonexistent",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow(/FOREIGN KEY|constraint/i);
  });

  it("round-trips encrypted_data binary correctly", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const bigArray = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bigArray[i] = i;
    const blob = testBlob(bigArray);

    db.insert(systemSettings)
      .values({
        id: `sset_${crypto.randomUUID()}`,
        systemId,
        encryptedData: blob,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.systemId, systemId))
      .all();
    expect(rows[0]?.encryptedData).toEqual(blob);
  });
});
