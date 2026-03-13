import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { safeModeContent } from "../schema/sqlite/safe-mode-content.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteSafeModeContentTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, safeModeContent };

describe("SQLite safe_mode_content schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteSafeModeContentTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves with all columns", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const data = testBlob(new Uint8Array([10, 20, 30]));

    db.insert(safeModeContent)
      .values({
        id,
        systemId,
        sortOrder: 1,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(safeModeContent).where(eq(safeModeContent.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.sortOrder).toBe(1);
    expect(rows[0]?.encryptedData).toEqual(data);
    expect(rows[0]?.createdAt).toBe(now);
    expect(rows[0]?.updatedAt).toBe(now);
  });

  it("defaults version to 1", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(safeModeContent)
      .values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(safeModeContent).where(eq(safeModeContent.id, id)).all();
    expect(rows[0]?.version).toBe(1);
  });

  it("defaults sort_order to 0", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(safeModeContent)
      .values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(safeModeContent).where(eq(safeModeContent.id, id)).all();
    expect(rows[0]?.sortOrder).toBe(0);
  });

  it("supports multiple items with ordering", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      db.insert(safeModeContent)
        .values({
          id: crypto.randomUUID(),
          systemId,
          sortOrder: i + 1,
          encryptedData: testBlob(new Uint8Array([i + 1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    const rows = db
      .select()
      .from(safeModeContent)
      .where(eq(safeModeContent.systemId, systemId))
      .all();
    expect(rows).toHaveLength(3);
    const sortOrders = rows.map((r) => r.sortOrder).sort();
    expect(sortOrders).toEqual([1, 2, 3]);
  });

  it("round-trips encrypted_data binary correctly", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const bigArray = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bigArray[i] = i;
    const blob = testBlob(bigArray);

    db.insert(safeModeContent)
      .values({
        id,
        systemId,
        encryptedData: blob,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(safeModeContent).where(eq(safeModeContent.id, id)).all();
    expect(rows[0]?.encryptedData).toEqual(blob);
  });

  it("cascades on system deletion", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(safeModeContent)
      .values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db.select().from(safeModeContent).where(eq(safeModeContent.id, id)).all();
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent systemId FK", () => {
    const now = Date.now();
    expect(() =>
      db
        .insert(safeModeContent)
        .values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow(/FOREIGN KEY|constraint/i);
  });

  it("rejects duplicate primary key", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(safeModeContent)
      .values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(() =>
      db
        .insert(safeModeContent)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([2])),
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow(/UNIQUE|constraint/i);
  });
});
