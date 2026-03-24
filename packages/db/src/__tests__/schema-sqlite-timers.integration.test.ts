import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";
import { checkInRecords, timerConfigs } from "../schema/sqlite/timers.js";

import {
  createSqliteTimerTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, timerConfigs, checkInRecords };

describe("SQLite timers schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string): string =>
    sqliteInsertMember(db, systemId, id);

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
    db.delete(checkInRecords).run();
    db.delete(timerConfigs).run();
  });

  describe("timer_configs", () => {
    it("round-trips with encrypted_data and defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
        const id = crypto.randomUUID();
        const now = Date.now();
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
              id: crypto.randomUUID(),
              systemId,
              wakingStart: bad,
              encryptedData: testBlob(new Uint8Array([1])),
              createdAt: Date.now(),
              updatedAt: Date.now(),
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
              id: crypto.randomUUID(),
              systemId,
              wakingEnd: bad,
              encryptedData: testBlob(new Uint8Array([1])),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            })
            .run(),
        ).toThrow();
      }
    });

    it("defaults T3 metadata to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();

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
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
          encryptedData: testBlob(new Uint8Array([1])),
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
      const data = testBlob(new Uint8Array([5, 6, 7]));

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
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

    it("restricts timer config deletion when referenced by check-in record", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(checkInRecords)
        .values({ id: crypto.randomUUID(), systemId, timerConfigId: timerId, scheduledAt: now })
        .run();

      expect(() => db.delete(timerConfigs).where(eq(timerConfigs.id, timerId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
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
          encryptedData: testBlob(new Uint8Array([1])),
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

    it("stores dismissed as false explicitly", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
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
          dismissed: false,
        })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.dismissed).toBe(false);
    });

    it("round-trips respondedByMemberId T3 column", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
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
          respondedByMemberId: memberId,
        })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.respondedByMemberId).toBe(memberId);
    });

    it("defaults respondedByMemberId to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
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
      expect(rows[0]?.respondedByMemberId).toBeNull();
    });

    it("restricts member deletion when referenced by check-in record", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const timerId = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(checkInRecords)
        .values({
          id: crypto.randomUUID(),
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
          respondedByMemberId: memberId,
        })
        .run();

      expect(() => db.delete(members).where(eq(members.id, memberId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
    });

    it("rejects nonexistent respondedByMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        db
          .insert(checkInRecords)
          .values({
            id: crypto.randomUUID(),
            systemId,
            timerConfigId: timerId,
            scheduledAt: now,
            respondedByMemberId: "nonexistent",
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("queries pending check-ins by system_id", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const pendingId = crypto.randomUUID();
      const respondedId = crypto.randomUUID();
      const dismissedId = crypto.randomUUID();

      db.insert(checkInRecords)
        .values([
          { id: pendingId, systemId, timerConfigId: timerId, scheduledAt: now },
          {
            id: respondedId,
            systemId,
            timerConfigId: timerId,
            scheduledAt: now + 1000,
            respondedAt: now + 2000,
          },
          {
            id: dismissedId,
            systemId,
            timerConfigId: timerId,
            scheduledAt: now + 3000,
            dismissed: true,
          },
        ])
        .run();

      const pending = client
        .prepare(
          "SELECT id FROM check_in_records WHERE system_id = ? AND responded_at IS NULL AND dismissed = 0 ORDER BY scheduled_at",
        )
        .all(systemId) as Array<{ id: string }>;
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(pendingId);
    });

    it("defaults archived to false and archivedAt to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(checkInRecords)
        .values({ id, systemId, timerConfigId: timerId, scheduledAt: now })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
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
          archived: true,
          archivedAt: now,
        })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("excludes archived pending check-ins from system_pending partial index", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const activeId = crypto.randomUUID();
      const archivedId = crypto.randomUUID();

      db.insert(checkInRecords)
        .values([
          { id: activeId, systemId, timerConfigId: timerId, scheduledAt: now },
          {
            id: archivedId,
            systemId,
            timerConfigId: timerId,
            scheduledAt: now,
            archived: true,
            archivedAt: now,
          },
        ])
        .run();

      const pending = client
        .prepare(
          "SELECT id FROM check_in_records WHERE system_id = ? AND responded_at IS NULL AND dismissed = 0 AND archived = 0 ORDER BY scheduled_at",
        )
        .all(systemId) as Array<{ id: string }>;
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(activeId);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client
          .prepare(
            "INSERT INTO check_in_records (id, system_id, timer_config_id, scheduled_at, archived, archived_at) VALUES (?, ?, ?, ?, 1, NULL)",
          )
          .run(crypto.randomUUID(), systemId, timerId, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      expect(() =>
        client
          .prepare(
            "INSERT INTO check_in_records (id, system_id, timer_config_id, scheduled_at, archived, archived_at) VALUES (?, ?, ?, ?, 0, ?)",
          )
          .run(crypto.randomUUID(), systemId, timerId, now, now),
      ).toThrow(/CHECK|constraint/i);
    });

    it("updates archived from false to true", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(timerConfigs)
        .values({
          id: timerId,
          systemId,
          encryptedData: testBlob(new Uint8Array([1])),
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

      db.update(checkInRecords)
        .set({ archived: true, archivedAt: now })
        .where(eq(checkInRecords.id, id))
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });
  });
});
