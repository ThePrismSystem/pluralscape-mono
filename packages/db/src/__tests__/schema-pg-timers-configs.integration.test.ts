import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { systems } from "../schema/pg/systems.js";
import { timerConfigs } from "../schema/pg/timers.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { testBlob } from "./helpers/pg-helpers.js";
import {
  clearTimersTables,
  insertAccount as insertAccountWith,
  insertSystem as insertSystemWith,
  setupTimersFixture,
  teardownTimersFixture,
  type TimersDb,
} from "./helpers/timers-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { TimerId } from "@pluralscape/types";

describe("PG timers schema — timer configs", () => {
  let client: PGlite;
  let db: TimersDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);

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

  describe("timer_configs", () => {
    it("round-trips with encrypted_data and defaults", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();
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
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

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
        const id = brandId<TimerId>(crypto.randomUUID());
        const now = fixtureNow();
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
            id: brandId<TimerId>(crypto.randomUUID()),
            systemId,
            wakingStart: bad,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: fixtureNow(),
            updatedAt: fixtureNow(),
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
            id: brandId<TimerId>(crypto.randomUUID()),
            systemId,
            wakingEnd: bad,
            encryptedData: testBlob(new Uint8Array([1])),
            createdAt: fixtureNow(),
            updatedAt: fixtureNow(),
          }),
        ).rejects.toThrow();
      }
    });

    it("defaults T3 metadata to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

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

    it("defaults archived to false and archivedAt to null", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows[0]?.archived).toBe(false);
      expect(rows[0]?.archivedAt).toBeNull();
    });

    it("round-trips archived: true with archivedAt timestamp", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        archived: true,
        archivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(now);
    });

    it("updates archived from false to true", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<TimerId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(timerConfigs).values({
        id,
        systemId,
        encryptedData: testBlob(new Uint8Array([1])),
        createdAt: now,
        updatedAt: now,
      });

      const updateNow = fixtureNow();
      await db
        .update(timerConfigs)
        .set({ archived: true, archivedAt: updateNow })
        .where(eq(timerConfigs.id, id));
      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows[0]?.archived).toBe(true);
      expect(rows[0]?.archivedAt).toBe(updateNow);
    });

    it("rejects archived=true with archivedAt=null via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO timer_configs (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x01'::bytea, $3, $4, 1, true, NULL)",
          [crypto.randomUUID(), systemId, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });

    it("rejects archived=false with archivedAt set via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await expect(
        client.query(
          "INSERT INTO timer_configs (id, system_id, encrypted_data, created_at, updated_at, version, archived, archived_at) VALUES ($1, $2, '\\x01'::bytea, $3, $4, 1, false, $5)",
          [crypto.randomUUID(), systemId, now, now, now],
        ),
      ).rejects.toThrow(/check|constraint/i);
    });
  });
});
