import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteSystemTables,
  sqliteInsertAccount,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { AccountId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems };

describe("SQLite systems schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): AccountId => sqliteInsertAccount(db, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteSystemTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves with all columns", () => {
    const accountId = insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();
    const data = testBlob(new Uint8Array([1, 2, 3, 4, 5]));

    db.insert(systems)
      .values({
        id,
        accountId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(id);
    expect(rows[0]?.accountId).toBe(accountId);
    expect(rows[0]?.encryptedData).toEqual(data);
  });

  it("allows nullable encrypted_data", () => {
    const accountId = insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(systems)
      .values({
        id,
        accountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows[0]?.encryptedData).toBeNull();
  });

  it("round-trips encrypted_data binary correctly", () => {
    const accountId = insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();
    const bigArray = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bigArray[i] = i;
    const blob = testBlob(bigArray);

    db.insert(systems)
      .values({
        id,
        accountId,
        encryptedData: blob,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows[0]?.encryptedData).toEqual(blob);
  });

  it("defaults version to 1", () => {
    const accountId = insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(systems)
      .values({
        id,
        accountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows[0]?.version).toBe(1);
  });

  it("cascades on account deletion", () => {
    const accountId = insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(systems)
      .values({
        id,
        accountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.delete(accounts).where(eq(accounts.id, accountId)).run();
    const rows = db.select().from(systems).where(eq(systems.id, id)).all();
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent accountId FK", () => {
    const now = Date.now();
    expect(() =>
      db
        .insert(systems)
        .values({
          id: crypto.randomUUID(),
          accountId: "nonexistent",
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow(/FOREIGN KEY|constraint/i);
  });

  it("rejects duplicate primary key", () => {
    const accountId = insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(systems)
      .values({
        id,
        accountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(() =>
      db
        .insert(systems)
        .values({
          id,
          accountId,
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow(/UNIQUE|constraint/i);
  });
});
