import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { systemSettings } from "../schema/sqlite/system-settings.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteSystemSettingsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { SystemId, SystemSettingsId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, systemSettings };

describe("SQLite system_settings schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);

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
    const now = fixtureNow();
    const data = testBlob(new Uint8Array([10, 20, 30]));

    db.insert(systemSettings)
      .values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
        systemId,
        locale: "en",
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
    expect(rows[0]?.locale).toBe("en");
    expect(rows[0]?.pinHash).toBe("$argon2id$test-hash");
    expect(rows[0]?.biometricEnabled).toBe(true);
    expect(rows[0]?.encryptedData).toEqual(data);
  });

  it("defaults boolean fields to false", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = fixtureNow();

    db.insert(systemSettings)
      .values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
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
    const now = fixtureNow();

    db.insert(systemSettings)
      .values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
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
    const now = fixtureNow();

    db.insert(systemSettings)
      .values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
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
    const now = fixtureNow();

    db.insert(systemSettings)
      .values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
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
          id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
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
    const now = fixtureNow();

    db.insert(systemSettings)
      .values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
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

  it("rejects pinHash that does not start with $argon2id$", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = fixtureNow();

    expect(() =>
      client
        .prepare(
          "INSERT INTO system_settings (id, system_id, pin_hash, encrypted_data, created_at, updated_at, version) VALUES (?, ?, 'bcrypt$hash', X'0102', ?, ?, 1)",
        )
        .run(`sset_${crypto.randomUUID()}`, systemId, now, now),
    ).toThrow(/CHECK|constraint/i);
  });

  it("rejects nonexistent systemId FK", () => {
    const now = fixtureNow();
    expect(() =>
      db
        .insert(systemSettings)
        .values({
          id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
          systemId: brandId<SystemId>("nonexistent"),
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
    const now = fixtureNow();
    const bigArray = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bigArray[i] = i;
    const blob = testBlob(bigArray);

    db.insert(systemSettings)
      .values({
        id: brandId<SystemSettingsId>(`sset_${crypto.randomUUID()}`),
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
