import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { members } from "../schema/pg/members.js";
import { systems } from "../schema/pg/systems.js";
import { checkInRecords, timerConfigs } from "../schema/pg/timers.js";

import {
  createPgTimerTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
  testBlob,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, members, timerConfigs, checkInRecords };

describe("PG timers schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);
  const insertMember = (systemId: string, id?: string) => pgInsertMember(db, systemId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgTimerTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("timer_configs", () => {
    it("round-trips with encrypted_data and defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const data = testBlob(new Uint8Array([10, 20, 30]));

      await db.insert(timerConfigs).values({
        id,
        systemId,
        encryptedData: data,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedData).toEqual(data);
      expect(rows[0]?.enabled).toBe(true);
      expect(rows[0]?.version).toBe(1);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(timerConfigs).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows).toHaveLength(0);
    });

    it("stores enabled as false correctly", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(timerConfigs).values({
        id,
        systemId,
        enabled: false,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows[0]?.enabled).toBe(false);
    });

    it("round-trips T3 metadata columns", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(timerConfigs).values({
        id,
        systemId,
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: "08:00",
        wakingEnd: "22:00",
        encryptedData: testBlob(new Uint8Array([1, 2, 3])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows[0]?.intervalMinutes).toBe(30);
      expect(rows[0]?.wakingHoursOnly).toBe(true);
      expect(rows[0]?.wakingStart).toBe("08:00");
      expect(rows[0]?.wakingEnd).toBe("22:00");
    });

    it("accepts valid HH:MM time strings", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      for (const [start, end] of [
        ["00:00", "23:59"],
        ["08:30", "22:00"],
        ["12:00", "18:45"],
      ]) {
        const id = crypto.randomUUID();
        const now = Date.now();
        await db.insert(timerConfigs).values({
          id,
          systemId,
          wakingStart: start,
          wakingEnd: end,
          encryptedData: testBlob(new Uint8Array([1])),
          createdAt: now,
          updatedAt: now,
        });
        const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
        expect(rows[0]?.wakingStart).toBe(start);
        expect(rows[0]?.wakingEnd).toBe(end);
      }
    });

    it("rejects invalid wakingStart time format", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      for (const bad of ["24:00", "8:00", "25:00", "12:60", "ab:cd", "1200", ""]) {
        await expect(
          db.insert(timerConfigs).values({
            id: crypto.randomUUID(),
            systemId,
            wakingStart: bad,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }),
        ).rejects.toThrow();
      }
    });

    it("rejects invalid wakingEnd time format", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      for (const bad of ["24:00", "9:30", "99:99"]) {
        await expect(
          db.insert(timerConfigs).values({
            id: crypto.randomUUID(),
            systemId,
            wakingEnd: bad,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }),
        ).rejects.toThrow();
      }
    });

    it("defaults T3 metadata to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(timerConfigs).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows[0]?.intervalMinutes).toBeNull();
      expect(rows[0]?.wakingHoursOnly).toBeNull();
      expect(rows[0]?.wakingStart).toBeNull();
      expect(rows[0]?.wakingEnd).toBeNull();
    });
  });

  describe("check_in_records", () => {
    it("round-trips with defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();
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
        respondedAt: now + 1000,
        dismissed: true,
        encryptedData: data,
      });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.respondedAt).toBe(now + 1000);
      expect(rows[0]?.dismissed).toBe(true);
      expect(rows[0]?.encryptedData).toEqual(data);
    });

    it("cascades on timer config deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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

      await db.delete(timerConfigs).where(eq(timerConfigs.id, timerId));
      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows).toHaveLength(0);
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
        respondedByMemberId: memberId,
      });

      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.respondedByMemberId).toBe(memberId);
    });

    it("defaults respondedByMemberId to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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

    it("sets respondedByMemberId to null on member deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const memberId = await insertMember(systemId);
      const timerId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const now = Date.now();

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
        respondedByMemberId: memberId,
      });

      await db.delete(members).where(eq(members.id, memberId));
      const rows = await db.select().from(checkInRecords).where(eq(checkInRecords.id, id));
      expect(rows[0]?.respondedByMemberId).toBeNull();
    });

    it("rejects nonexistent respondedByMemberId FK", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const timerId = crypto.randomUUID();
      const now = Date.now();

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(checkInRecords).values({
          id: crypto.randomUUID(),
          systemId,
          timerConfigId: timerId,
          scheduledAt: now,
          respondedByMemberId: "nonexistent",
        }),
      ).rejects.toThrow();
    });
  });
});
