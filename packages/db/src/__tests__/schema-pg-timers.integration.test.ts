import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { systems } from "../schema/pg/systems.js";
import { checkInRecords, timerConfigs } from "../schema/pg/timers.js";

import { createPgTimerTables, pgInsertAccount, pgInsertSystem } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, timerConfigs, checkInRecords };

describe("PG timers schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

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
      const data = new Uint8Array([10, 20, 30]);

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
        encryptedData: new Uint8Array([1]),
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
        encryptedData: new Uint8Array([1]),
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(timerConfigs).where(eq(timerConfigs.id, id));
      expect(rows[0]?.enabled).toBe(false);
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
        encryptedData: new Uint8Array([1]),
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
      const data = new Uint8Array([5, 6, 7]);

      await db.insert(timerConfigs).values({
        id: timerId,
        systemId,
        encryptedData: new Uint8Array([1]),
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
        encryptedData: new Uint8Array([1]),
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
        encryptedData: new Uint8Array([1]),
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
        encryptedData: new Uint8Array([1]),
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
  });
});
