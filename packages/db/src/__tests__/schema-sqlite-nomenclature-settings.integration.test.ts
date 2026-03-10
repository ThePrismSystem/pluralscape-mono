import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { nomenclatureSettings } from "../schema/sqlite/nomenclature-settings.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteNomenclatureSettingsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, nomenclatureSettings };

describe("SQLite nomenclature_settings schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteNomenclatureSettingsTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves with all columns", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const data = new Uint8Array([10, 20, 30]);

    db.insert(nomenclatureSettings)
      .values({
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(nomenclatureSettings)
      .where(eq(nomenclatureSettings.systemId, systemId))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.encryptedData).toEqual(data);
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
  });

  it("defaults version to 1", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(nomenclatureSettings)
      .values({
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(nomenclatureSettings)
      .where(eq(nomenclatureSettings.systemId, systemId))
      .all();
    expect(rows[0]?.version).toBe(1);
  });

  it("round-trips encrypted_data binary correctly", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const blob = new Uint8Array(256);
    for (let i = 0; i < 256; i++) blob[i] = i;

    db.insert(nomenclatureSettings)
      .values({
        systemId,
        encryptedData: blob,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db
      .select()
      .from(nomenclatureSettings)
      .where(eq(nomenclatureSettings.systemId, systemId))
      .all();
    expect(rows[0]?.encryptedData).toEqual(blob);
  });

  it("enforces 1:1 with systems (rejects duplicate systemId)", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(nomenclatureSettings)
      .values({
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(() =>
      db
        .insert(nomenclatureSettings)
        .values({
          systemId,
          encryptedData: new Uint8Array([2]),
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

    db.insert(nomenclatureSettings)
      .values({
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db
      .select()
      .from(nomenclatureSettings)
      .where(eq(nomenclatureSettings.systemId, systemId))
      .all();
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent systemId FK", () => {
    const now = Date.now();
    expect(() =>
      db
        .insert(nomenclatureSettings)
        .values({
          systemId: "nonexistent",
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow(/FOREIGN KEY|constraint/i);
  });

  it("supports version increment", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(nomenclatureSettings)
      .values({
        systemId,
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.update(nomenclatureSettings)
      .set({ version: 2, updatedAt: Date.now() })
      .where(eq(nomenclatureSettings.systemId, systemId))
      .run();

    const rows = db
      .select()
      .from(nomenclatureSettings)
      .where(eq(nomenclatureSettings.systemId, systemId))
      .all();
    expect(rows[0]?.version).toBe(2);
  });
});
