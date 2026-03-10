import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
        })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.progressPercent).toBe(0);
      expect(rows[0]?.warningCount).toBe(0);
      expect(rows[0]?.chunksCompleted).toBe(0);
      expect(rows[0]?.chunksTotal).toBeNull();
      expect(rows[0]?.updatedAt).toBeNull();
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
        })
        .run();

      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows[0]?.errorLog).toEqual(errors);
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
        })
        .run();

      db.delete(systems).where(eq(systems.id, systemId)).run();
      const rows = db.select().from(importJobs).where(eq(importJobs.id, id)).all();
      expect(rows).toHaveLength(0);
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
          encryptedData: new Uint8Array([1, 2, 3]),
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
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, accountId)).run();
      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows).toHaveLength(0);
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
  });
});
