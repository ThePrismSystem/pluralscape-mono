import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { apiKeys } from "../schema/sqlite/api-keys.js";
import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteApiKeysTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, apiKeys };

describe("SQLite api_keys schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteApiKeysTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves a metadata API key", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const tokenHash = `hash_${crypto.randomUUID()}`;

    db.insert(apiKeys)
      .values({
        id,
        accountId,
        systemId,
        name: "My API Key",
        keyType: "metadata",
        tokenHash,
        scopes: ["read:members", "read:fronting"],
        createdAt: now,
      })
      .run();

    const rows = db.select().from(apiKeys).where(eq(apiKeys.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.accountId).toBe(accountId);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.name).toBe("My API Key");
    expect(rows[0]?.keyType).toBe("metadata");
    expect(rows[0]?.tokenHash).toBe(tokenHash);
    expect(rows[0]?.scopes).toEqual(["read:members", "read:fronting"]);
    expect(rows[0]?.encryptedKeyMaterial).toBeNull();
  });

  it("inserts and retrieves a crypto API key", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const tokenHash = `hash_${crypto.randomUUID()}`;
    const keyMaterial = new Uint8Array([1, 2, 3, 4, 5]);

    db.insert(apiKeys)
      .values({
        id,
        accountId,
        systemId,
        name: "Crypto Key",
        keyType: "crypto",
        tokenHash,
        scopes: ["full"],
        encryptedKeyMaterial: keyMaterial,
        scopedBucketIds: ["bucket-1", "bucket-2"],
        createdAt: now,
      })
      .run();

    const rows = db.select().from(apiKeys).where(eq(apiKeys.id, id)).all();
    expect(rows[0]?.keyType).toBe("crypto");
    expect(rows[0]?.encryptedKeyMaterial).toEqual(keyMaterial);
    expect(rows[0]?.scopedBucketIds).toEqual(["bucket-1", "bucket-2"]);
  });

  it("rejects invalid key_type via CHECK constraint", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    expect(() =>
      db
        .insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          name: "Bad Key",
          keyType: "invalid" as "metadata",
          tokenHash: `hash_${crypto.randomUUID()}`,
          scopes: ["full"],
          createdAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("enforces unique token_hash", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const tokenHash = `hash_${crypto.randomUUID()}`;

    db.insert(apiKeys)
      .values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        name: "Key 1",
        keyType: "metadata",
        tokenHash,
        scopes: ["full"],
        createdAt: now,
      })
      .run();

    expect(() =>
      db
        .insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          name: "Key 2",
          keyType: "metadata",
          tokenHash,
          scopes: ["full"],
          createdAt: now,
        })
        .run(),
    ).toThrow(/UNIQUE|constraint/i);
  });

  it("allows nullable optional fields", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(apiKeys)
      .values({
        id,
        accountId,
        systemId,
        name: "Minimal Key",
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["read:members"],
        createdAt: now,
      })
      .run();

    const rows = db.select().from(apiKeys).where(eq(apiKeys.id, id)).all();
    expect(rows[0]?.encryptedKeyMaterial).toBeNull();
    expect(rows[0]?.lastUsedAt).toBeNull();
    expect(rows[0]?.revokedAt).toBeNull();
    expect(rows[0]?.expiresAt).toBeNull();
    expect(rows[0]?.scopedBucketIds).toBeNull();
  });

  it("stores and retrieves timestamps", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const later = now + 86400000;
    const id = crypto.randomUUID();

    db.insert(apiKeys)
      .values({
        id,
        accountId,
        systemId,
        name: "Timed Key",
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        createdAt: now,
        lastUsedAt: now,
        revokedAt: later,
        expiresAt: later,
      })
      .run();

    const rows = db.select().from(apiKeys).where(eq(apiKeys.id, id)).all();
    expect(rows[0]?.lastUsedAt).toBe(now);
    expect(rows[0]?.revokedAt).toBe(later);
    expect(rows[0]?.expiresAt).toBe(later);
  });

  it("cascades on account deletion", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(apiKeys)
      .values({
        id,
        accountId,
        systemId,
        name: "Cascade Test",
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        createdAt: now,
      })
      .run();

    db.delete(accounts).where(eq(accounts.id, accountId)).run();
    const rows = db.select().from(apiKeys).where(eq(apiKeys.id, id)).all();
    expect(rows).toHaveLength(0);
  });

  it("cascades on system deletion", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(apiKeys)
      .values({
        id,
        accountId,
        systemId,
        name: "System Cascade Test",
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        createdAt: now,
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db.select().from(apiKeys).where(eq(apiKeys.id, id)).all();
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent accountId FK", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    expect(() =>
      db
        .insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          accountId: "nonexistent",
          systemId,
          name: "Bad FK",
          keyType: "metadata",
          tokenHash: `hash_${crypto.randomUUID()}`,
          scopes: ["full"],
          createdAt: now,
        })
        .run(),
    ).toThrow(/FOREIGN KEY|constraint/i);
  });

  it("rejects nonexistent systemId FK", () => {
    const accountId = insertAccount();
    const now = Date.now();

    expect(() =>
      db
        .insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId: "nonexistent",
          name: "Bad FK",
          keyType: "metadata",
          tokenHash: `hash_${crypto.randomUUID()}`,
          scopes: ["full"],
          createdAt: now,
        })
        .run(),
    ).toThrow(/FOREIGN KEY|constraint/i);
  });

  it("rejects metadata key with encrypted_key_material", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    expect(() =>
      db
        .insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          name: "Bad Metadata Key",
          keyType: "metadata",
          tokenHash: `hash_${crypto.randomUUID()}`,
          scopes: ["full"],
          encryptedKeyMaterial: new Uint8Array([1, 2, 3]),
          createdAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("rejects crypto key without encrypted_key_material", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    expect(() =>
      db
        .insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          name: "Bad Crypto Key",
          keyType: "crypto",
          tokenHash: `hash_${crypto.randomUUID()}`,
          scopes: ["full"],
          createdAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("round-trips empty scopes array", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(apiKeys)
      .values({
        id,
        accountId,
        systemId,
        name: "Empty Scopes Key",
        keyType: "metadata",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: [],
        createdAt: now,
      })
      .run();

    const rows = db.select().from(apiKeys).where(eq(apiKeys.id, id)).all();
    expect(rows[0]?.scopes).toEqual([]);
  });

  it("round-trips empty Uint8Array for encrypted_key_material", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const emptyMaterial = new Uint8Array(0);

    db.insert(apiKeys)
      .values({
        id,
        accountId,
        systemId,
        name: "Empty Material Key",
        keyType: "crypto",
        tokenHash: `hash_${crypto.randomUUID()}`,
        scopes: ["full"],
        encryptedKeyMaterial: emptyMaterial,
        createdAt: now,
      })
      .run();

    const rows = db.select().from(apiKeys).where(eq(apiKeys.id, id)).all();
    expect(rows[0]?.encryptedKeyMaterial).toEqual(emptyMaterial);
  });
});
