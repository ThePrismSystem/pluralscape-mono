import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { blobMetadata } from "../schema/sqlite/blob-metadata.js";
import {
  accountPurgeRequests,
  exportRequests,
  importJobs,
} from "../schema/sqlite/import-export.js";
import { buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import {
  createSqliteImportExportTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = {
  accounts,
  systems,
  buckets,
  blobMetadata,
  importJobs,
  exportRequests,
  accountPurgeRequests,
};

describe("SQLite import-export schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  const insertAccount = (id?: string): string => sqliteInsertAccount(db, id);
  const insertSystem = (accountId: string, id?: string): string =>
    sqliteInsertSystem(db, accountId, id);

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
    db.delete(exportRequests).run();
    db.delete(accountPurgeRequests).run();
  });

  describe("import_jobs", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "simply-plural",
          status: "importing",
          progressPercent: 42,
          errorLog: [{ line: 5, message: "duplicate entry" }],
          warningCount: 3,
          chunksTotal: 10,
          chunksCompleted: 4,
          createdAt: now,
          updatedAt: now + 1000,
          completedAt: now + 5000,
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
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(importJobs)
        .values({
          id,
          accountId,
          systemId,
          source: "pluralkit",
          createdAt: now,
          updatedAt: now,
        })
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
      const id = crypto.randomUUID();
      const now = Date.now();
      const errors = [
        { code: "INVALID_FORMAT", detail: "bad date" },
        { code: "MISSING_FIELD", detail: "name required" },
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
      const now = Date.now();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: crypto.randomUUID(),
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
      const now = Date.now();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: crypto.randomUUID(),
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
      const now = Date.now();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: crypto.randomUUID(),
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: crypto.randomUUID(),
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const now = Date.now();

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: crypto.randomUUID(),
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
      const id = crypto.randomUUID();
      const now = Date.now();

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
      const id = crypto.randomUUID();
      const now = Date.now();
      const errors = Array.from({ length: 1000 }, (_, i) => ({
        line: i,
        message: `error ${String(i)}`,
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
      const now = Date.now();
      const errors = Array.from({ length: 1001 }, (_, i) => ({
        line: i,
        message: `error ${String(i)}`,
      }));

      expect(() =>
        db
          .insert(importJobs)
          .values({
            id: crypto.randomUUID(),
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

  describe("export_requests", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const blobId = crypto.randomUUID();
      const now = Date.now();

      db.insert(buckets)
        .values({
          id: crypto.randomUUID(),
          systemId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(blobMetadata)
        .values({
          id: blobId,
          systemId,
          storageKey: `key_${crypto.randomUUID()}`,
          sizeBytes: 1024,
          encryptionTier: 1,
          purpose: "export",
          checksum: "a".repeat(64),
          uploadedAt: now,
        })
        .run();

      db.insert(exportRequests)
        .values({
          id,
          accountId,
          systemId,
          format: "json",
          status: "completed",
          blobId,
          createdAt: now,
          updatedAt: now,
          completedAt: now + 3000,
        })
        .run();

      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(accountId);
      expect(rows[0]?.systemId).toBe(systemId);
      expect(rows[0]?.format).toBe("json");
      expect(rows[0]?.status).toBe("completed");
      expect(rows[0]?.blobId).toBe(blobId);
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.completedAt).toBe(now + 3000);
    });

    it("applies default value for status", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(exportRequests)
        .values({
          id,
          accountId,
          systemId,
          format: "csv",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.blobId).toBeNull();
      expect(rows[0]?.completedAt).toBeNull();
    });

    it("cascades on account deletion", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(exportRequests)
        .values({
          id,
          accountId,
          systemId,
          format: "json",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, accountId)).run();
      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects invalid format value", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(exportRequests)
          .values({
            id: crypto.randomUUID(),
            accountId,
            systemId,
            format: "xml" as "json",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("rejects invalid status value", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = Date.now();

      expect(() =>
        db
          .insert(exportRequests)
          .values({
            id: crypto.randomUUID(),
            accountId,
            systemId,
            format: "json",
            status: "bogus" as "pending",
            createdAt: now,
            updatedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it.each(["processing", "failed"] as const)("exercises %s status", (status) => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(exportRequests)
        .values({ id, accountId, systemId, format: "json", status, createdAt: now, updatedAt: now })
        .run();

      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows[0]?.status).toBe(status);
    });

    it("sets blobId to null when blob is deleted", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const blobId = crypto.randomUUID();
      const exportId = crypto.randomUUID();
      const now = Date.now();

      db.insert(buckets)
        .values({
          id: crypto.randomUUID(),
          systemId,
          encryptedData: testBlob(),
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.insert(blobMetadata)
        .values({
          id: blobId,
          systemId,
          storageKey: `key_${crypto.randomUUID()}`,
          sizeBytes: 1024,
          encryptionTier: 1,
          purpose: "export",
          checksum: "a".repeat(64),
          uploadedAt: now,
        })
        .run();

      db.insert(exportRequests)
        .values({
          id: exportId,
          accountId,
          systemId,
          format: "json",
          status: "completed",
          blobId,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      db.delete(blobMetadata).where(eq(blobMetadata.id, blobId)).run();

      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, exportId)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.blobId).toBeNull();
    });

    it("allows null blobId", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(exportRequests)
        .values({
          id,
          accountId,
          systemId,
          format: "json",
          blobId: null,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.blobId).toBeNull();
    });
  });

  describe("account_purge_requests", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(accountPurgeRequests)
        .values({
          id,
          accountId,
          status: "confirmed",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now + 86400000,
          requestedAt: now,
          confirmedAt: now + 1000,
          completedAt: now + 86400000,
          cancelledAt: null,
        })
        .run();

      const rows = db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(accountId);
      expect(rows[0]?.status).toBe("confirmed");
      expect(rows[0]?.confirmationPhrase).toBe("DELETE MY ACCOUNT");
      expect(rows[0]?.scheduledPurgeAt).toBe(now + 86400000);
      expect(rows[0]?.requestedAt).toBe(now);
      expect(rows[0]?.confirmedAt).toBe(now + 1000);
      expect(rows[0]?.completedAt).toBe(now + 86400000);
      expect(rows[0]?.cancelledAt).toBeNull();
    });

    it("rejects invalid status value", () => {
      const accountId = insertAccount();
      const now = Date.now();

      expect(() =>
        db
          .insert(accountPurgeRequests)
          .values({
            id: crypto.randomUUID(),
            accountId,
            status: "invalid-status" as "pending",
            confirmationPhrase: "DELETE MY ACCOUNT",
            scheduledPurgeAt: now + 86400000,
            requestedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("applies default status of pending", () => {
      const accountId = insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(accountPurgeRequests)
        .values({
          id,
          accountId,
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, id))
        .all();
      expect(rows[0]?.status).toBe("pending");
    });

    it("cascades on account deletion", () => {
      const accountId = insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(accountPurgeRequests)
        .values({
          id,
          accountId,
          status: "pending",
          confirmationPhrase: "CONFIRM DELETE",
          scheduledPurgeAt: now + 86400000,
          requestedAt: now,
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, accountId)).run();
      const rows = db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("rejects second active purge request when first is confirmed", () => {
      const accountId = insertAccount();
      const now = Date.now();
      const firstId = crypto.randomUUID();

      db.insert(accountPurgeRequests)
        .values({
          id: firstId,
          accountId,
          status: "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        })
        .run();

      client
        .prepare(`UPDATE account_purge_requests SET status = 'confirmed' WHERE id = ?`)
        .run(firstId);

      expect(() =>
        db
          .insert(accountPurgeRequests)
          .values({
            id: crypto.randomUUID(),
            accountId,
            status: "pending",
            confirmationPhrase: "DELETE MY ACCOUNT",
            scheduledPurgeAt: now,
            requestedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("allows new purge request after previous is completed", () => {
      const accountId = insertAccount();
      const now = Date.now();
      const firstId = crypto.randomUUID();

      db.insert(accountPurgeRequests)
        .values({
          id: firstId,
          accountId,
          status: "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        })
        .run();

      client
        .prepare(`UPDATE account_purge_requests SET status = 'completed' WHERE id = ?`)
        .run(firstId);

      const secondId = crypto.randomUUID();
      db.insert(accountPurgeRequests)
        .values({
          id: secondId,
          accountId,
          status: "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, secondId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
    });

    it("allows new purge request after previous is cancelled", () => {
      const accountId = insertAccount();
      const now = Date.now();
      const firstId = crypto.randomUUID();

      db.insert(accountPurgeRequests)
        .values({
          id: firstId,
          accountId,
          status: "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        })
        .run();

      client
        .prepare(`UPDATE account_purge_requests SET status = 'cancelled' WHERE id = ?`)
        .run(firstId);

      const secondId = crypto.randomUUID();
      db.insert(accountPurgeRequests)
        .values({
          id: secondId,
          accountId,
          status: "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        })
        .run();

      const rows = db
        .select()
        .from(accountPurgeRequests)
        .where(eq(accountPurgeRequests.id, secondId))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
    });

    it("rejects second active purge request when first is processing", () => {
      const accountId = insertAccount();
      const now = Date.now();
      const firstId = crypto.randomUUID();

      db.insert(accountPurgeRequests)
        .values({
          id: firstId,
          accountId,
          status: "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        })
        .run();

      client
        .prepare(`UPDATE account_purge_requests SET status = 'processing' WHERE id = ?`)
        .run(firstId);

      expect(() =>
        db
          .insert(accountPurgeRequests)
          .values({
            id: crypto.randomUUID(),
            accountId,
            status: "pending",
            confirmationPhrase: "DELETE MY ACCOUNT",
            scheduledPurgeAt: now,
            requestedAt: now,
          })
          .run(),
      ).toThrow();
    });
  });
});
