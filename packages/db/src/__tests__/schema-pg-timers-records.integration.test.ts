import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { members } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";
import { checkInRecords, timerConfigs } from "../schema/pg/timers.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { testBlob } from "./helpers/pg-helpers.js";
import {
  clearTimersTables,
  insertAccount as insertAccountWith,
  insertMember as insertMemberWith,
  insertSystem as insertSystemWith,
  setupTimersFixture,
  teardownTimersFixture,
  type TimersDb,
} from "./helpers/timers-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { CheckInRecordId, MemberId, TimerId } from "@pluralscape/types";

describe("PG timers schema — check-in records", () => {
  let client: PGlite;
  let db: TimersDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => insertMemberWith(db, systemId, id);

  beforeAll(async () => {
    const fixture = await setupTimersFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownTimersFixture({ client, db });
  });

  afterEach(async () => {
    await clearTimersTables(db);
  });

  describe("check_in_records", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id,
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
      });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.dismissed).toBe(false);
      expect(rows[0]?.respondedAt).toBeNull();
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("round-trips with responded and encrypted data", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();
      const data = testBlob(new Uint8Array([5, 6, 7]));

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id,
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
        respondedAt: toUnixMillis(now + 1000),
        dismissed: true,
        encryptedData: data,
      });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.respondedAt).toBe(now + 1000);
      expect(rows[0]?.dismissed).toBe(true);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("restricts timer config deletion when referenced by check-in record", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id: brandId<CheckInRecordId>(crypto.randomUUID()),
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
      });

      await expect(db.delete(timerConfigs).where(eq(timerConfigs.id, timerId))).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id,
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows).toHaveLength(0);
    });

    it("stores dismissed as false explicitly", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id,
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
        dismissed: false,
      });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.dismissed).toBe(false);
    });

    it("round-trips respondedByMemberId T3 column", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id,
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
        respondedByMemberId: brandId<MemberId>(memberId),
      });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.respondedByMemberId).toBe(memberId);
    });

    it("defaults respondedByMemberId to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id,
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
      });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.respondedByMemberId).toBeNull();
    });

    it("restricts member deletion when referenced by check-in record", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id: brandId<CheckInRecordId>(crypto.randomUUID()),
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
        respondedByMemberId: brandId<MemberId>(memberId),
      });

      await expect(db.delete(members).where(eq(members.id, memberId))).rejects.toThrow();
    });

    it("rejects nonexistent respondedByMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(checkInRecords).values({
          id: brandId<CheckInRecordId>(crypto.randomUUID()),
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
          respondedByMemberId: brandId<MemberId>("nonexistent"),
        }),
      ).rejects.toThrow();
    });

    it("queries pending check-ins by system_id", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const pendingId = brandId<CheckInRecordId>(crypto.randomUUID());
      const respondedId = brandId<CheckInRecordId>(crypto.randomUUID());
      const dismissedId = brandId<CheckInRecordId>(crypto.randomUUID());

      await db.insert(checkInRecords).values([
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
      ]);

      const pending = await client.query<{ id: string }>(
        "SELECT id FROM check_in_records WHERE system_id = $1 AND responded_at IS NULL AND dismissed = false ORDER BY scheduled_at",
        [systemId],
      );
      expect(pending.rows).toHaveLength(1);
      expect(pending.rows[0]?.id).toBe(pendingId);
    });

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db
        .insert(checkInRecords)
        .values({ id, systemId, timerConfigId: timerId, scheduledAt: now });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(checkInRecords).values({
        id,
        systemId,
        timerConfigId: timerId,
        scheduledAt: now,
        archived: true,
        archivedAt: now,
      });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const id = brandId<CheckInRecordId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db
        .insert(checkInRecords)
        .values({ id, systemId, timerConfigId: timerId, scheduledAt: now });

      const updateNow = fixtureNow();
      await db
        .update(checkInRecords)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(checkInRecords.id, id));
      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("excludes archived pending check-ins from system_pending partial index", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const activeId = brandId<CheckInRecordId>(crypto.randomUUID());
      const archivedId = brandId<CheckInRecordId>(crypto.randomUUID());

      await db.insert(checkInRecords).values([
        { id: activeId, systemId, timerConfigId: timerId, scheduledAt: now },
        {
          id: archivedId,
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
          archived: true,
          archivedAt: now,
        },
      ]);

      const pending = await client.query<{ id: string }>(
        "SELECT id FROM check_in_records WHERE system_id = $1 AND responded_at IS NULL AND dismissed = false AND archived = false ORDER BY scheduled_at",
        [systemId],
      );
      expect(pending.rows).toHaveLength(1);
      expect(pending.rows[0]?.id).toBe(activeId);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query(
          "INSERT INTO check_in_records (id, system_id, timer_config_id, scheduled_at, archived, archived_at) VALUES ($1, $2, $3, $4, true, NULL)",
          [crypto.randomUUID(), systemId, timerId, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        client.query(
          "INSERT INTO check_in_records (id, system_id, timer_config_id, scheduled_at, archived, archived_at) VALUES ($1, $2, $3, $4, false, $5)",
          [crypto.randomUUID(), systemId, timerId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
