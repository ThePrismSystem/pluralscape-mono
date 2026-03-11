import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { lifecycleEvents } from "../schema/sqlite/lifecycle-events.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteLifecycleEventsTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, lifecycleEvents };

describe("SQLite lifecycle_events schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteLifecycleEventsTables(client);
  });

  afterAll(() => {
    client.close();
  });

  it("inserts and retrieves with all columns", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const occurred = Date.now() - 86400000;
    const recorded = Date.now();
    const id = crypto.randomUUID();
    const data = testBlob(new Uint8Array([10, 20, 30]));

    db.insert(lifecycleEvents)
      .values({
        id,
        systemId,
        occurredAt: occurred,
        recordedAt: recorded,
        encryptedData: data,
      })
      .run();

    const rows = db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.systemId).toBe(systemId);
    expect(rows[0]?.occurredAt).toBe(occurred);
    expect(rows[0]?.recordedAt).toBe(recorded);
    expect(rows[0]?.encryptedData).toEqual(data);
  });

  it("round-trips encrypted_data binary correctly", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();
    const bigArray = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bigArray[i] = i;
    const blob = testBlob(bigArray);

    db.insert(lifecycleEvents)
      .values({
        id,
        systemId,
        occurredAt: now,
        recordedAt: now,
        encryptedData: blob,
      })
      .run();

    const rows = db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id)).all();
    expect(rows[0]?.encryptedData).toEqual(blob);
  });

  it("allows multiple events per system", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    db.insert(lifecycleEvents)
      .values({
        id: crypto.randomUUID(),
        systemId,
        occurredAt: now,
        recordedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
      })
      .run();

    db.insert(lifecycleEvents)
      .values({
        id: crypto.randomUUID(),
        systemId,
        occurredAt: now + 1000,
        recordedAt: now + 1000,
        encryptedData: testBlob(new Uint8Array([2])),
      })
      .run();

    const rows = db
      .select()
      .from(lifecycleEvents)
      .where(eq(lifecycleEvents.systemId, systemId))
      .all();
    expect(rows).toHaveLength(2);
  });

  it("supports separate occurred_at and recorded_at", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const occurred = Date.now() - 3600000;
    const recorded = Date.now();
    const id = crypto.randomUUID();

    db.insert(lifecycleEvents)
      .values({
        id,
        systemId,
        occurredAt: occurred,
        recordedAt: recorded,
        encryptedData: testBlob(new Uint8Array([1])),
      })
      .run();

    const rows = db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id)).all();
    expect(rows[0]?.occurredAt).toBe(occurred);
    expect(rows[0]?.recordedAt).toBe(recorded);
    expect(rows[0]?.occurredAt).not.toBe(rows[0]?.recordedAt);
  });

  it("cascades on system deletion", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(lifecycleEvents)
      .values({
        id,
        systemId,
        occurredAt: now,
        recordedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
      })
      .run();

    db.delete(systems).where(eq(systems.id, systemId)).run();
    const rows = db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id)).all();
    expect(rows).toHaveLength(0);
  });

  it("rejects nonexistent systemId FK", () => {
    const now = Date.now();
    expect(() =>
      db
        .insert(lifecycleEvents)
        .values({
          id: crypto.randomUUID(),
          systemId: "nonexistent",
          occurredAt: now,
          recordedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
        })
        .run(),
    ).toThrow(/FOREIGN KEY|constraint/i);
  });

  it("rejects duplicate primary key", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();
    const id = crypto.randomUUID();

    db.insert(lifecycleEvents)
      .values({
        id,
        systemId,
        occurredAt: now,
        recordedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
      })
      .run();

    expect(() =>
      db
        .insert(lifecycleEvents)
        .values({
          id,
          systemId,
          occurredAt: now,
          recordedAt: now,
          encryptedData: testBlob(new Uint8Array([2])),
        })
        .run(),
    ).toThrow(/UNIQUE|constraint/i);
  });

  it("round-trips eventType T3 column", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(lifecycleEvents)
      .values({
        id,
        systemId,
        eventType: "discovery",
        occurredAt: now,
        recordedAt: now,
        encryptedData: testBlob(new Uint8Array([1, 2, 3])),
      })
      .run();

    const rows = db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id)).all();
    expect(rows[0]?.eventType).toBe("discovery");
  });

  it("defaults eventType to null", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const id = crypto.randomUUID();
    const now = Date.now();

    db.insert(lifecycleEvents)
      .values({
        id,
        systemId,
        occurredAt: now,
        recordedAt: now,
        encryptedData: testBlob(new Uint8Array([1])),
      })
      .run();

    const rows = db.select().from(lifecycleEvents).where(eq(lifecycleEvents.id, id)).all();
    expect(rows[0]?.eventType).toBeNull();
  });

  it("rejects invalid eventType via CHECK constraint", () => {
    const accountId = insertAccount();
    const systemId = sqliteInsertSystem(db, accountId);
    const now = Date.now();

    expect(() =>
      db
        .insert(lifecycleEvents)
        .values({
          id: crypto.randomUUID(),
          systemId,
          eventType: "invalid" as "discovery",
          occurredAt: now,
          recordedAt: now,
          encryptedData: testBlob(new Uint8Array([1])),
        })
        .run(),
    ).toThrow(/CHECK|constraint/i);
  });
});
