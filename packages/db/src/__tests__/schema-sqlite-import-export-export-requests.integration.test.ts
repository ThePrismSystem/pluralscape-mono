/**
 * SQLite import-export schema — export_requests table.
 *
 * Covers: export_requests (9 tests).
 *
 * Source: schema-sqlite-import-export-requests.integration.test.ts (lines 62-271)
 */

import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { blobMetadata } from "../schema/sqlite/blob-metadata.js";
import { exportRequests } from "../schema/sqlite/import-export.js";
import { buckets } from "../schema/sqlite/privacy.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteImportExportTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
  testBlob,
} from "./helpers/sqlite-helpers.js";

import type { BlobId, BucketId, ChecksumHex, ImportJobId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, buckets, blobMetadata, exportRequests };

describe("SQLite import-export schema — export_requests", () => {
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
    db.delete(exportRequests).run();
    db.delete(blobMetadata).run();
    db.delete(buckets).run();
  });

  describe("export_requests", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const blobId = brandId<BlobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(buckets)
        .values({
          id: brandId<BucketId>(crypto.randomUUID()),
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
          checksum: brandId<ChecksumHex>("a".repeat(64)),
          createdAt: now,
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
          completedAt: toUnixMillis(now + 3000),
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(exportRequests)
        .values({ id, accountId, systemId, format: "csv", createdAt: now, updatedAt: now })
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(exportRequests)
        .values({ id, accountId, systemId, format: "json", createdAt: now, updatedAt: now })
        .run();

      db.delete(accounts).where(eq(accounts.id, accountId)).run();
      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects invalid format value", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(exportRequests)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(exportRequests)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(exportRequests)
        .values({ id, accountId, systemId, format: "json", status, createdAt: now, updatedAt: now })
        .run();

      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows[0]?.status).toBe(status);
    });

    it("sets blobId to null when blob is deleted", () => {
      const accountId = insertAccount();
      const systemId = insertSystem(accountId);
      const blobId = brandId<BlobId>(crypto.randomUUID());
      const exportId = crypto.randomUUID();
      const now = fixtureNow();

      db.insert(buckets)
        .values({
          id: brandId<BucketId>(crypto.randomUUID()),
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
          checksum: brandId<ChecksumHex>("a".repeat(64)),
          createdAt: now,
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(exportRequests)
        .values({ id, accountId, systemId, format: "json", blobId: null, createdAt: now, updatedAt: now })
        .run();

      const rows = db.select().from(exportRequests).where(eq(exportRequests.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.blobId).toBeNull();
    });
  });
});
