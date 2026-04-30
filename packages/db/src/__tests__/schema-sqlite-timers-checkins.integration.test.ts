/**
 * SQLite timers schema — check_in_records table.
 *
 * Covers: check_in_records lifecycle, FK constraints, archival,
 *   T3 metadata, pending-index query, partial-index exclusion = 15 tests.
 *
 * Source: schema-sqlite-timers.integration.test.ts (lines 337–859)
 */

import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { members } from "../schema/sqlite/members.js";
import { systems } from "../schema/sqlite/systems.js";
import { checkInRecords, timerConfigs } from "../schema/sqlite/timers.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteTimerTables,
  sqliteInsertAccount,
  sqliteInsertMember,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { CheckInRecordId, MemberId, SystemId, TimerId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, members, timerConfigs, checkInRecords };

describe("SQLite timers schema — check_in_records", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string): MemberId =>
    sqliteInsertMember(db, systemId, id);

  /** Insert a timer config and return its id. */
  function insertTimer(systemId: SystemId): TimerId {
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
    return id;
  }

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

  describe("check_in_records", () => {
    it("round-trips with defaults", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(checkInRecords)
        .values({ id, systemId, timerConfigId: timerId, scheduledAt: now })
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
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([5, 6, 7]));

      db.insert(checkInRecords)
        .values({
          id,
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
          respondedAt: toUnixMillis(now + 1000),
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
      const timerId = insertTimer(systemId);
      const now = fixtureNow();

      db.insert(checkInRecords)
        .values({
          id: brandId<CheckInRecordId>(crypto.randomUUID()),
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
        })
        .run();

      expect(() => db.delete(timerConfigs).where(eq(timerConfigs.id, timerId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(checkInRecords)
        .values({ id, systemId, timerConfigId: timerId, scheduledAt: now })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("stores dismissed as false explicitly", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(checkInRecords)
        .values({ id, systemId, timerConfigId: timerId, scheduledAt: now, dismissed: false })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.dismissed).toBe(false);
    });

    it("round-trips respondedByMemberId T3 column", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(checkInRecords)
        .values({
          id,
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
          respondedByMemberId: brandId<MemberId>(memberId),
        })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.respondedByMemberId).toBe(memberId);
    });

    it("defaults respondedByMemberId to null", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(checkInRecords)
        .values({ id, systemId, timerConfigId: timerId, scheduledAt: now })
        .run();

      const rows = db.select().from(checkInRecords).where(eq(checkInRecords.id, id)).all();
      expect(rows[0]?.respondedByMemberId).toBeNull();
    });

    it("restricts member deletion when referenced by check-in record", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const memberId = insertMember(systemId);
      const timerId = insertTimer(systemId);
      const now = fixtureNow();

      db.insert(checkInRecords)
        .values({
          id: brandId<CheckInRecordId>(crypto.randomUUID()),
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
          respondedByMemberId: brandId<MemberId>(memberId),
        })
        .run();

      expect(() => db.delete(members).where(eq(members.id, memberId)).run()).toThrow(
        /FOREIGN KEY|constraint/i,
      );
    });

    it("rejects nonexistent respondedByMemberId FK", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = insertTimer(systemId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(checkInRecords)
          .values({
            id: brandId<CheckInRecordId>(crypto.randomUUID()),
            systemId,
            timerConfigId: timerId,
            scheduledAt: now,
            respondedByMemberId: brandId<MemberId>("nonexistent"),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("queries pending check-ins by system_id", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const timerId = insertTimer(systemId);
      const now = fixtureNow();

      const pendingId = brandId<CheckInRecordId>(crypto.randomUUID());
      const respondedId = brandId<CheckInRecordId>(crypto.randomUUID());
      const dismissedId = brandId<CheckInRecordId>(crypto.randomUUID());

      db.insert(checkInRecords)
        .values([
          { id: pendingId, systemId, timerConfigId: timerId, scheduledAt: now },
          {
            id: respondedId,
            systemId,
            timerConfigId: timerId,
            scheduledAt: toUnixMillis(now + 1000),
            respondedAt: toUnixMillis(now + 2000),
          },
          {
            id: dismissedId,
            systemId,
            timerConfigId: timerId,
            scheduledAt: toUnixMillis(now + 3000),
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
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const timerId = insertTimer(systemId);
      const now = fixtureNow();

      const activeId = brandId<CheckInRecordId>(crypto.randomUUID());
      const archivedId = brandId<CheckInRecordId>(crypto.randomUUID());

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
      const timerId = insertTimer(systemId);
      const now = fixtureNow();

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
      const timerId = insertTimer(systemId);
      const now = fixtureNow();

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
      const timerId = insertTimer(systemId);
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(checkInRecords)
        .values({ id, systemId, timerConfigId: timerId, scheduledAt: now })
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
