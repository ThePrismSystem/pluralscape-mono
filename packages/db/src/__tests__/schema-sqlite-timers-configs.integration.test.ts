/**
 * SQLite timers schema — timer_configs table.
 *
 * Covers: timer_configs lifecycle, defaults, archival, T3 metadata,
 *   time-format CHECK constraints = 14 tests.
 *
 * Source: schema-sqlite-timers.integration.test.ts (lines 51–335)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { systems } from "../schema/sqlite/systems.js";
import { timerConfigs } from "../schema/sqlite/timers.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteTimerTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { TimerId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, timerConfigs };

describe("SQLite timers schema — timer_configs", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteTimerTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(timerConfigs).run();
  });

  describe("timer_configs", () => {
    it("round-trips with encrypted_data and defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([10, 20, 30]));

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
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("stores enabled as false correctly", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          enabled: false,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows[0]?.enabled).toBe(false);
    });

    it("round-trips T3 metadata columns", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          intervalMinutes: 30,
          wakingHoursOnly: true,
          wakingStart: "08:00",
          wakingEnd: "22:00",
          encryptedData: testBlob(new Uint8Array([1, 2, 3])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows[0]?.intervalMinutes).toBe(30);
      expect(rows[0]?.wakingHoursOnly).toBe(true);
      expect(rows[0]?.wakingStart).toBe("08:00");
      expect(rows[0]?.wakingEnd).toBe("22:00");
    });

    it("accepts valid HH:MM time strings", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);

      for (const [start, end] of [
        ["00:00", "23:59"],
        ["08:30", "22:00"],
        ["12:00", "18:45"],
      ]) {
        const id = brandId<TimerId>(crypto.randomUUID());
        const now = fixtureNow();
        db.insert(timerConfigs)
          .values({
            id,
            systemId,
            wakingStart: start,
            wakingEnd: end,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: now,
            updatedAt: now,
          })
          .run();
        const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
        expect(rows[0]?.wakingStart).toBe(start);
        expect(rows[0]?.wakingEnd).toBe(end);
      }
    });

    it("rejects invalid wakingStart time format", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);

      for (const bad of ["24:00", "8:00", "25:00", "12:60", "ab:cd", "1200", ""]) {
        expect(() =>
          db
            .insert(timerConfigs)
            .values({
              id: brandId<TimerId>(crypto.randomUUID()),
              systemId,
              wakingStart: bad,
              encryptedData: testBlob(new Uint8Array([1])),
              createdAt: fixtureNow(),
              updatedAt: fixtureNow(),
            })
            .run(),
        ).toThrow();
      }
    });

    it("rejects invalid wakingEnd time format", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);

      for (const bad of ["24:00", "9:30", "99:99"]) {
        expect(() =>
          db
            .insert(timerConfigs)
            .values({
              id: brandId<TimerId>(crypto.randomUUID()),
              systemId,
              wakingEnd: bad,
              encryptedData: testBlob(new Uint8Array([1])),
              createdAt: fixtureNow(),
              updatedAt: fixtureNow(),
            })
            .run(),
        ).toThrow();
      }
    });

    it("defaults T3 metadata to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows[0]?.intervalMinutes).toBeNull();
      expect(rows[0]?.wakingHoursOnly).toBeNull();
      expect(rows[0]?.wakingStart).toBeNull();
      expect(rows[0]?.wakingEnd).toBeNull();
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          archived: true,
          archivedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO timer_configs (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'01', ?, ?, 1, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        client
          .prepare(
            "INSERT INTO timer_configs (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES (?, ?, X'01', ?, ?, 1, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, now, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(timerConfigs)
        .values({
          id,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.update(timerConfigs)
        .set({ archived: true, archivedAt: now, updatedAt: now })
        .where(eq(timerConfigs.id, id))
        .run();

      const rows = db.select().from(timerConfigs).where(eq(timerConfigs.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });
});
