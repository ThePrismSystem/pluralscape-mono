import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pkBridgeConfigs } from "../schema/sqlite/pk-bridge.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqlitePkBridgeTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type DatabaseConstructor from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { pkBridgeConfigs, systems };

describe("SQLite PK Bridge Schema", () => {
  let client: InstanceType<typeof DatabaseConstructor>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqlitePkBridgeTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("round-trips all fields including binary columns and timestamps", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const pkToken = new Uint8Array([10, 20, 30]);
    const entityMappings = testBlob(new Uint8Array([40, 50, 60]));
    const errorLog = testBlob(new Uint8Array([70, 80, 90]));

    db.insert(pkBridgeConfigs)
      .values({
        id,
        systemId,
        enabled: true,
        syncDirection: "bidirectional",
        pkTokenEncrypted: pkToken,
        entityMappings,
        errorLog,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.id).toBe(id);
    expect(row?.systemId).toBe(systemId);
    expect(row?.enabled).toBe(true);
    expect(row?.syncDirection).toBe("bidirectional");
    expect(row?.pkTokenEncrypted).toEqual(pkToken);
    expect(row?.entityMappings.ciphertext).toEqual(entityMappings.ciphertext);
    expect(row?.errorLog.ciphertext).toEqual(errorLog.ciphertext);
    expect(row?.lastSyncAt).toBe(now);
    expect(row?.createdAt).toBe(now);
    expect(row?.updatedAt).toBe(now);
  });

  it("defaults enabled to true when not explicitly set", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(pkBridgeConfigs)
      .values({
        id,
        systemId,
        syncDirection: "ps-to-pk",
        pkTokenEncrypted: new Uint8Array([1]),
        entityMappings: testBlob(),
        errorLog: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.enabled).toBe(true);
  });

  it("accepts all valid syncDirection values", () => {
    const validDirections = ["ps-to-pk", "pk-to-ps", "bidirectional"] as const;

    for (const direction of validDirections) {
      const accountId = insertAccount();
      const systemId = sqliteInsertSystem(db, accountId);
      const now = Date.now();
      const id = crypto.randomUUID();

      db.insert(pkBridgeConfigs)
        .values({
          id,
          systemId,
          syncDirection: direction,
          pkTokenEncrypted: new Uint8Array([1]),
          entityMappings: testBlob(),
          errorLog: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
      expect(rows[0]?.syncDirection).toBe(direction);
    }
  });

  it("rejects invalid syncDirection via CHECK constraint", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    expect(() =>
      db
        .insert(pkBridgeConfigs)
        .values({
          id: crypto.randomUUID(),
          systemId,
          syncDirection: "invalid-direction" as "bidirectional",
          pkTokenEncrypted: new Uint8Array([1]),
          entityMappings: testBlob(),
          errorLog: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow();
  });

  it("allows null lastSyncAt", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(pkBridgeConfigs)
      .values({
        id,
        systemId,
        syncDirection: "pk-to-ps",
        pkTokenEncrypted: new Uint8Array([1]),
        entityMappings: testBlob(),
        errorLog: testBlob(),
        lastSyncAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(rows[0]?.lastSyncAt).toBeNull();
  });

  it("stores non-null lastSyncAt timestamp", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const syncTime = now - 60000;
    const id = crypto.randomUUID();

    db.insert(pkBridgeConfigs)
      .values({
        id,
        systemId,
        syncDirection: "ps-to-pk",
        pkTokenEncrypted: new Uint8Array([1]),
        entityMappings: testBlob(),
        errorLog: testBlob(),
        lastSyncAt: syncTime,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(rows[0]?.lastSyncAt).toBe(syncTime);
  });

  it("round-trips larger Uint8Array data for all binary columns", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    const largePkToken = new Uint8Array(256);
    const largeEntityCiphertext = new Uint8Array(512);
    const largeErrorCiphertext = new Uint8Array(1024);
    for (let i = 0; i < largePkToken.length; i++) largePkToken[i] = i % 256;
    for (let i = 0; i < largeEntityCiphertext.length; i++) largeEntityCiphertext[i] = (i * 3) % 256;
    for (let i = 0; i < largeErrorCiphertext.length; i++) largeErrorCiphertext[i] = (i * 7) % 256;
    const largeEntityMappings = testBlob(largeEntityCiphertext);
    const largeErrorLog = testBlob(largeErrorCiphertext);

    db.insert(pkBridgeConfigs)
      .values({
        id,
        systemId,
        syncDirection: "bidirectional",
        pkTokenEncrypted: largePkToken,
        entityMappings: largeEntityMappings,
        errorLog: largeErrorLog,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(rows[0]?.pkTokenEncrypted).toEqual(largePkToken);
    expect(rows[0]?.entityMappings.ciphertext).toEqual(largeEntityCiphertext);
    expect(rows[0]?.errorLog.ciphertext).toEqual(largeErrorCiphertext);
  });

  it("cascades delete when parent system is deleted", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(pkBridgeConfigs)
      .values({
        id,
        systemId,
        syncDirection: "ps-to-pk",
        pkTokenEncrypted: new Uint8Array([1]),
        entityMappings: testBlob(),
        errorLog: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Verify the row exists
    const beforeRows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(beforeRows).toHaveLength(1);

    // Delete the system via raw SQL to trigger cascade
    client.exec(`DELETE FROM systems WHERE id = '${systemId}'`);

    const afterRows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(afterRows).toHaveLength(0);
  });

  it("defaults version to 1", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(pkBridgeConfigs)
      .values({
        id,
        systemId,
        syncDirection: "pk-to-ps",
        pkTokenEncrypted: new Uint8Array([1]),
        entityMappings: testBlob(),
        errorLog: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(rows[0]?.version).toBe(1);
  });

  it("rejects nonexistent systemId FK", () => {
    const now = Date.now();

    expect(() =>
      db
        .insert(pkBridgeConfigs)
        .values({
          id: crypto.randomUUID(),
          systemId: "nonexistent-system-id",
          syncDirection: "ps-to-pk",
          pkTokenEncrypted: new Uint8Array([1]),
          entityMappings: testBlob(),
          errorLog: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run(),
    ).toThrow(/FOREIGN KEY|constraint/i);
  });

  it("stores enabled as false and retrieves it correctly", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(pkBridgeConfigs)
      .values({
        id,
        systemId,
        enabled: false,
        syncDirection: "bidirectional",
        pkTokenEncrypted: new Uint8Array([1]),
        entityMappings: testBlob(),
        errorLog: testBlob(),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rows = db.select().from(pkBridgeConfigs).where(eq(pkBridgeConfigs.id, id)).all();
    expect(rows[0]?.enabled).toBe(false);
  });
});
