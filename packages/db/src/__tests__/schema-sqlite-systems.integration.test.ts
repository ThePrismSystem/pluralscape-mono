import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems };

describe("SQLite systems schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  function insertAccount(id = crypto.randomUUID()): string {
    const now = Date.now();
    db.insert(accounts)
      .values({
        id,
        emailHash: `hash_${crypto.randomUUID()}`,
        emailSalt: `salt_${crypto.randomUUID()}`,
        passwordHash: `$argon2id$${crypto.randomUUID()}`,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return id;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });

    client.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        email_hash TEXT NOT NULL UNIQUE,
        email_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    client.exec(`
      CREATE TABLE systems (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        encrypted_data BLOB,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves with all columns", () => {
    const accountId = insertAccount();
    const now = Date.now();
    const id = crypto.randomUUID();
    const data = new Uint8Array([1, 2, 3, 4, 5]);

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
    const blob = new Uint8Array(256);
    for (let i = 0; i < 256; i++) blob[i] = i;

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
});
