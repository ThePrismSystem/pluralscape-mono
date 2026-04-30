import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { importJobs } from "../schema/pg/import-export.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  clearImportExportTables,
  insertAccount as insertAccountWith,
  insertSystem as insertSystemWith,
  setupImportExportFixture,
  teardownImportExportFixture,
  type ImportExportDb,
} from "./helpers/import-export-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { ImportJobId } from "@pluralscape/types";

describe("PG import-export schema — import jobs", () => {
  let client: PGlite;
  let db: ImportExportDb;

  const insertAccount = (id?: string) => insertAccountWith(db, id);
  const insertSystem = (accountId: string, id?: string) => insertSystemWith(db, accountId, id);

  beforeAll(async () => {
    const fixture = await setupImportExportFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownImportExportFixture({ client, db });
  });

  afterEach(async () => {
    await clearImportExportTables(db);
  });

  describe("import_jobs", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        status: "importing",
        progressPercent: 42,
        errorLog: [{ entityType: "unknown", entityId: null, message: "bad row", fatal: false }],
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
      expect(rows[0]?.errorLog).toEqual([
        { entityType: "unknown", entityId: null, message: "bad row", fatal: false },
      ]);
      expect(rows[0]?.warningCount).toBe(3);
      expect(rows[0]?.chunksTotal).toBe(10);
      expect(rows[0]?.chunksCompleted).toBe(4);
      expect(rows[0]?.completedAt).toBe(now);
    });

    it("applies default values for status, progressPercent, warningCount, chunksCompleted", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      await expect(
        db.insert(importJobs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      await expect(
        db.insert(importJobs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      await expect(
        db.insert(importJobs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      await expect(
        db.insert(importJobs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      await expect(
        db.insert(importJobs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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

    it("rejects cross-tenant system reference via composite FK", async () => {
      const accountA = await insertAccount();
      const accountB = await insertAccount();
      const systemOfB = await insertSystem(accountB);
      const now = fixtureNow();

      await expect(
        db.insert(importJobs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
          accountId: accountA,
          systemId: systemOfB,
          source: "pluralscape",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("round-trips JSON error_log array", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();
      const errors = [
        {
          entityType: "unknown" as const,
          entityId: null,
          message: "unexpected token",
          fatal: false as const,
        },
        {
          entityType: "unknown" as const,
          entityId: null,
          message: "name is required",
          fatal: false as const,
        },
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();
      const errors = Array.from({ length: 1000 }, (_, i) => ({
        entityType: "unknown" as const,
        entityId: null,
        message: `error ${String(i)}`,
        fatal: false as const,
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
      const now = fixtureNow();
      const errors = Array.from({ length: 1001 }, (_, i) => ({
        entityType: "unknown" as const,
        entityId: null,
        message: `error ${String(i)}`,
        fatal: false as const,
      }));

      await expect(
        db.insert(importJobs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
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
});
