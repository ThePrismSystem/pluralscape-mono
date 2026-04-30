/**
 * SQLite import-export schema — import_jobs table.
 *
 * Covers: import_jobs lifecycle, default values, JSON error_log,
 *   CHECK constraints, cascade on system deletion = 14 tests.
 *
 * Source: schema-sqlite-import-export.integration.test.ts (lines 62–421)
 */

import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { importJobs } from "../schema/sqlite/import-export.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteImportExportTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { ImportJobId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, importJobs };

describe("SQLite import-export schema — import_jobs", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string) => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string) => sqliteInsertSystem(db, accountId, id);

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteImportExportTables(client);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(importJobs).run();
  });

  describe("import_jobs", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "simply-plural",
          status: "importing",
          progressPercent: 42,
          errorLog: [
            {
              entityType: "unknown" as const,
              entityId: null,
              message: "duplicate entry",
              fatal: false as const,
            },
          ],
          warningCount: 3,
          chunksTotal: 10,
          chunksCompleted: 4,
          createdAt: now,
          updatedAt: toUnixMillis(now + 1000),
          completedAt: toUnixMillis(now + 5000),
        })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(accountId);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.source).toBe("simply-plural");
      expect(rows[0]?.status).toBe("importing");
      expect(rows[0]?.progressPercent).toBe(42);
      expect(rows[0]?.warningCount).toBe(3);
      expect(rows[0]?.chunksTotal).toBe(10);
      expect(rows[0]?.chunksCompleted).toBe(4);
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.updatedAt).toBe(now + 1000);
      expect(rows[0]?.completedAt).toBe(now + 5000);
    });

    it("applies default values for status, progressPercent, warningCount, chunksCompleted", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(importJobs)
        .values({ id, accountId, systemId, source: "pluralkit", createdAt: now, updatedAt: now })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.progressPercent).toBe(0);
      expect(rows[0]?.warningCount).toBe(0);
      expect(rows[0]?.chunksCompleted).toBe(0);
      expect(rows[0]?.chunksTotal).toBeNull();
      expect(rows[0]?.updatedAt).toBe(now);
      expect(rows[0]?.completedAt).toBeNull();
      expect(rows[0]?.errorLog).toBeNull();
    });

    it("round-trips JSON error_log", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();
      const errors = [
        {
          entityType: "unknown" as const,
          entityId: null,
          message: "INVALID_FORMAT: bad date",
          fatal: false as const,
        },
        {
          entityType: "unknown" as const,
          entityId: null,
          message: "MISSING_FIELD: name required",
          fatal: false as const,
        },
      ];

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "pluralscape",
          errorLog: errors,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows[0]?.errorLog).toEqual(errors);
    });

    it("rejects invalid source value", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
            accountId,
            systemId,
            source: "invalid-source" as "simply-plural",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects invalid status value", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
            accountId,
            systemId,
            source: "pluralkit",
            status: "bogus-status" as "pending",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects negative progressPercent", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
            accountId,
            systemId,
            source: "pluralscape",
            progressPercent: -1,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("accepts progressPercent at 0", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "pluralscape",
          progressPercent: 0,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows[0]?.progressPercent).toBe(0);
    });

    it("accepts progressPercent at 100", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "pluralscape",
          progressPercent: 100,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows[0]?.progressPercent).toBe(100);
    });

    it("rejects progressPercent above 100", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
            accountId,
            systemId,
            source: "pluralscape",
            progressPercent: 101,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it.each(["validating", "failed"] as const)("exercises %s status", (status) => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "pluralkit",
          status,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows[0]?.status).toBe(status);
    });

    it("rejects chunksCompleted exceeding chunksTotal", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
            accountId,
            systemId,
            source: "pluralscape",
            chunksCompleted: 5,
            chunksTotal: 3,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on system deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "simply-plural",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("accepts errorLog with 1000 entries", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();
      const errors = Array.from({ length: 1000 }, (_, i) => ({
        entityType: "unknown" as const,
        entityId: null,
        message: `error ${String(i)}`,
        fatal: false as const,
      }));

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "simply-plural",
          errorLog: errors,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows).toHaveLength(1);
    });

    it("rejects errorLog with more than 1000 entries", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();
      const errors = Array.from({ length: 1001 }, (_, i) => ({
        entityType: "unknown" as const,
        entityId: null,
        message: `error ${String(i)}`,
        fatal: false as const,
      }));

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
            accountId,
            systemId,
            source: "simply-plural",
            errorLog: errors,
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });
  });
});
