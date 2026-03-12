import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { accountPurgeRequests, exportRequests, importJobs } from "../schema/pg/import-export.js";
import { systems } from "../schema/pg/systems.js";

import {
  createPgImportExportTables,
  pgInsertAccount,
  pgInsertSystem,
} from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, systems, importJobs, exportRequests, accountPurgeRequests };

describe("PG import-export schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  const insertAccount = (id?: string) => pgInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => pgInsertSystem(db, accountId, id);

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgImportExportTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(importJobs);
    await db.delete(exportRequests);
    await db.delete(accountPurgeRequests);
  });

  describe("import_jobs", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        status: "importing",
        progressPercent: 42,
        errorLog: [{ line: 1, message: "bad row" }],
        warningCount: 3,
        chunksTotal: 10,
        chunksCompleted: 4,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(accountId);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.source).toBe("simply-plural");
      expect(rows[0]?.status).toBe("importing");
      expect(rows[0]?.progressPercent).toBe(42);
      expect(rows[0]?.errorLog).toEqual([{ line: 1, message: "bad row" }]);
      expect(rows[0]?.warningCount).toBe(3);
      expect(rows[0]?.chunksTotal).toBe(10);
      expect(rows[0]?.chunksCompleted).toBe(4);
      expect(rows[0]?.completedAt).toBe(now);
    });

    it("applies default values for status, progressPercent, warningCount, chunksCompleted", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "pluralkit",
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.progressPercent).toBe(0);
      expect(rows[0]?.warningCount).toBe(0);
      expect(rows[0]?.chunksCompleted).toBe(0);
      expect(rows[0]?.chunksTotal).toBeNull();
      expect(rows[0]?.errorLog).toBeNull();
      expect(rows[0]?.updatedAt).toBe(now);
      expect(rows[0]?.completedAt).toBeNull();
    });

    it("rejects negative progressPercent", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(importJobs).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          source: "pluralscape",
          progressPercent: -1,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("accepts progressPercent at 0", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "pluralscape",
        progressPercent: 0,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows[0]?.progressPercent).toBe(0);
    });

    it("accepts progressPercent at 100", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "pluralscape",
        progressPercent: 100,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows[0]?.progressPercent).toBe(100);
    });

    it("rejects progressPercent above 100", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(importJobs).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          source: "pluralscape",
          progressPercent: 101,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid source value", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(importJobs).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          source: "invalid-source" as "simply-plural",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid status value", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(importJobs).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          source: "pluralkit",
          status: "bogus-status" as "pending",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it.each(["validating", "failed"] as const)("exercises %s status", async (status) => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "pluralkit",
        status,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows[0]?.status).toBe(status);
    });

    it("rejects chunksCompleted exceeding chunksTotal", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(importJobs).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          source: "pluralscape",
          chunksCompleted: 5,
          chunksTotal: 3,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "pluralscape",
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(systems).where(eq(systems.id, systemId));
      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows).toHaveLength(0);
    });

    it("round-trips JSON error_log array", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const errors = [
        { code: "PARSE_FAIL", row: 12, detail: "unexpected token" },
        { code: "MISSING_FIELD", row: 45, detail: "name is required" },
      ];

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        errorLog: errors,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.errorLog).toEqual(errors);
    });

    it("accepts errorLog with 1000 entries", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();
      const errors = Array.from({ length: 1000 }, (_, i) => ({
        line: i,
        message: `error ${String(i)}`,
      }));

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        errorLog: errors,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows).toHaveLength(1);
    });

    it("rejects errorLog with more than 1000 entries", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();
      const errors = Array.from({ length: 1001 }, (_, i) => ({
        line: i,
        message: `error ${String(i)}`,
      }));

      await expect(
        db.insert(importJobs).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          source: "simply-plural",
          errorLog: errors,
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("export_requests", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(exportRequests).values({
        id,
        accountId,
        systemId,
        format: "json",
        status: "completed",
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });

      const rows = await db.select().from(exportRequests).where(eq(exportRequests.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(accountId);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.format).toBe("json");
      expect(rows[0]?.status).toBe("completed");
      expect(rows[0]?.blobId).toBeNull();
      expect(rows[0]?.completedAt).toBe(now);
    });

    it("applies default status of pending", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(exportRequests).values({
        id,
        accountId,
        systemId,
        format: "csv",
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(exportRequests).where(eq(exportRequests.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.completedAt).toBeNull();
    });

    it.each(["processing", "failed"] as const)("exercises %s status", async (status) => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(exportRequests).values({
        id,
        accountId,
        systemId,
        format: "json",
        status,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(exportRequests).where(eq(exportRequests.id, id));
      expect(rows[0]?.status).toBe(status);
    });

    it("rejects invalid format value", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = Date.now();

      await expect(
        db.insert(exportRequests).values({
          id: crypto.randomUUID(),
          accountId,
          systemId,
          format: "xml" as "json",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(exportRequests).values({
        id,
        accountId,
        systemId,
        format: "json",
        createdAt: now,
        updatedAt: now,
      });

      await db.delete(accounts).where(eq(accounts.id, accountId));
      const rows = await db.select().from(exportRequests).where(eq(exportRequests.id, id));
      expect(rows).toHaveLength(0);
    });

    it("allows nullable blobId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(exportRequests).values({
        id,
        accountId,
        systemId,
        format: "csv",
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(exportRequests).where(eq(exportRequests.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.blobId).toBeNull();
    });
  });

  describe("account_purge_requests", () => {
    it("round-trips all fields including all timestamps", async () => {
      const accountId = await insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(accountPurgeRequests).values({
        id,
        accountId,
        status: "completed",
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
        confirmedAt: now,
        completedAt: now,
        cancelledAt: now,
      });

      const rows = await db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(accountId);
      expect(rows[0]?.status).toBe("completed");
      expect(rows[0]?.confirmationPhrase).toBe("DELETE MY ACCOUNT");
      expect(rows[0]?.scheduledPurgeAt).toBe(now);
      expect(rows[0]?.requestedAt).toBe(now);
      expect(rows[0]?.confirmedAt).toBe(now);
      expect(rows[0]?.completedAt).toBe(now);
      expect(rows[0]?.cancelledAt).toBe(now);
    });

    it("applies default status of pending", async () => {
      const accountId = await insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(accountPurgeRequests).values({
        id,
        accountId,
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
      });

      const rows = await db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, id));
      expect(rows[0]?.status).toBe("pending");
    });

    it("rejects invalid status value", async () => {
      const accountId = await insertAccount();
      const now = Date.now();

      await expect(
        db.insert(accountPurgeRequests).values({
          id: crypto.randomUUID(),
          accountId,
          status: "invalid-status" as "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(accountPurgeRequests).values({
        id,
        accountId,
        status: "pending",
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
      });

      await db.delete(accounts).where(eq(accounts.id, accountId));
      const rows = await db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, id));
      expect(rows).toHaveLength(0);
    });

    it("allows nullable confirmedAt, completedAt, and cancelledAt", async () => {
      const accountId = await insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(accountPurgeRequests).values({
        id,
        accountId,
        status: "pending",
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
      });

      const rows = await db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.confirmedAt).toBeNull();
      expect(rows[0]?.completedAt).toBeNull();
      expect(rows[0]?.cancelledAt).toBeNull();
    });

    it("rejects second active purge request when first is confirmed", async () => {
      const accountId = await insertAccount();
      const now = Date.now();
      const firstId = crypto.randomUUID();

      await db.insert(accountPurgeRequests).values({
        id: firstId,
        accountId,
        status: "pending",
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
      });

      await client.query(`UPDATE account_purge_requests SET status = 'confirmed' WHERE id = $1`, [
        firstId,
      ]);

      await expect(
        db.insert(accountPurgeRequests).values({
          id: crypto.randomUUID(),
          accountId,
          status: "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows new purge request after previous is completed", async () => {
      const accountId = await insertAccount();
      const now = Date.now();
      const firstId = crypto.randomUUID();

      await db.insert(accountPurgeRequests).values({
        id: firstId,
        accountId,
        status: "pending",
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
      });

      await client.query(`UPDATE account_purge_requests SET status = 'completed' WHERE id = $1`, [
        firstId,
      ]);

      const secondId = crypto.randomUUID();
      await db.insert(accountPurgeRequests).values({
        id: secondId,
        accountId,
        status: "pending",
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
      });

      const rows = await db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, secondId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
    });
  });
});
