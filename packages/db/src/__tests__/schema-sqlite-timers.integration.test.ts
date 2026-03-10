import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";
import { checkInRecords, timerConfigs } from "../schema/sqlite/timers.js";

import {
  createSqliteTimerTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, timerConfigs, checkInRecords };

describe("SQLite timers schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteTimerTables(client);
  });

  afterAll(() => {
    client.close();
  });

  describe("timer_configs", () => {
    it("round-trips with encrypted_data and defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([10, 20, 30]);

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          encryptedData: data,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.enabled).toBe(true);
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("check_in_records", () => {
    it("round-trips with defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(checkInRecords)
        .values({
          id,
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
        })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.dismissed).toBe(false);
      expect(rows[0]?.respondedAt).toBeNull();
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("round-trips with responded and encrypted data", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = new Uint8Array([5, 6, 7]);

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(checkInRecords)
        .values({
          id,
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
          respondedAt: now + 1000,
          dismissed: true,
          encryptedData: data,
        })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.respondedAt).toBe(now + 1000);
      expect(rows[0]?.dismissed).toBe(true);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("cascades on timer config deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(checkInRecords)
        .values({
          id,
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
        })
        .run();

      db.delete(timerConfigs).where(eq(timerConfigs.id, timerId)).run();
      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: new Uint8Array([1]),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(checkInRecords)
        .values({
          id,
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });
});
