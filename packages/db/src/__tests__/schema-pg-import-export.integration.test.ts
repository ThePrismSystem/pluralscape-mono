import { PGlite } from "@electric-sql/pglite";
import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import {
  accountPurgeRequests,
  exportRequests,
  importEntityRefs,
  importJobs,
} from "../schema/pg/import-export.js";
import { systems } from "../schema/pg/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createPgImportExportTables,
  pgInsertAccount,
  pgInsertSystem,
} from "./helpers/pg-helpers.js";

import type {
  AccountPurgeRequestId,
  ImportCheckpointState,
  ImportJobId,
  ServerInternal,
} from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = {
  accounts,
  systems,
  importJobs,
  importEntityRefs,
  exportRequests,
  accountPurgeRequests,
};

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

  describe("export_requests", () => {
    it("round-trips all fields", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      await expect(
        db.insert(exportRequests).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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

    it("rejects cross-tenant system reference via composite FK", async () => {
      const accountA = await insertAccount();
      const accountB = await insertAccount();
      const systemOfB = await insertSystem(accountB);
      const now = fixtureNow();

      await expect(
        db.insert(exportRequests).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
          accountId: accountA,
          systemId: systemOfB,
          format: "json",
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("allows nullable blobId", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<AccountPurgeRequestId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<AccountPurgeRequestId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();

      await expect(
        db.insert(accountPurgeRequests).values({
          id: brandId<AccountPurgeRequestId>(crypto.randomUUID()),
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
      const id = brandId<AccountPurgeRequestId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<AccountPurgeRequestId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const now = fixtureNow();
      const firstId = brandId<AccountPurgeRequestId>(crypto.randomUUID());

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
          id: brandId<AccountPurgeRequestId>(crypto.randomUUID()),
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
      const now = fixtureNow();
      const firstId = brandId<AccountPurgeRequestId>(crypto.randomUUID());

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

      const secondId = brandId<AccountPurgeRequestId>(crypto.randomUUID());
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

    it("allows new purge request after previous is cancelled", async () => {
      const accountId = await insertAccount();
      const now = fixtureNow();
      const firstId = brandId<AccountPurgeRequestId>(crypto.randomUUID());

      await db.insert(accountPurgeRequests).values({
        id: firstId,
        accountId,
        status: "pending",
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
      });

      await client.query(`UPDATE account_purge_requests SET status = 'cancelled' WHERE id = $1`, [
        firstId,
      ]);

      const secondId = brandId<AccountPurgeRequestId>(crypto.randomUUID());
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

    it("rejects second active purge request when first is processing", async () => {
      const accountId = await insertAccount();
      const now = fixtureNow();
      const firstId = brandId<AccountPurgeRequestId>(crypto.randomUUID());

      await db.insert(accountPurgeRequests).values({
        id: firstId,
        accountId,
        status: "pending",
        confirmationPhrase: "DELETE MY ACCOUNT",
        scheduledPurgeAt: now,
        requestedAt: now,
      });

      await client.query(`UPDATE account_purge_requests SET status = 'processing' WHERE id = $1`, [
        firstId,
      ]);

      await expect(
        db.insert(accountPurgeRequests).values({
          id: brandId<AccountPurgeRequestId>(crypto.randomUUID()),
          accountId,
          status: "pending",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: now,
          requestedAt: now,
        }),
      ).rejects.toThrow();
    });
  });

  describe("import_jobs.checkpoint_state", () => {
    it("persists a full ImportCheckpointState as JSONB", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      const state: ImportCheckpointState = {
        schemaVersion: 2,
        checkpoint: {
          completedCollections: ["member"],
          currentCollection: "fronting-session",
          currentCollectionLastSourceId: "507f1f77bcf86cd799439011",
          realPrivacyBucketsMapped: true,
        },
        options: {
          selectedCategories: {
            member: true,
            group: true,
          } as Record<string, boolean | undefined>,
          avatarMode: "api",
        },
        totals: {
          perCollection: {
            member: { total: 20, imported: 20, updated: 0, skipped: 0, failed: 0 },
          } as Record<
            string,
            | { total: number; imported: number; updated: number; skipped: number; failed: number }
            | undefined
          >,
        },
      };

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        status: "importing",
        progressPercent: 25,
        // The DB column is branded `ServerInternal<…>` for wire-strip; tag
        // the literal at the insert site (compile-time only).
        checkpointState: state as ServerInternal<ImportCheckpointState>,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.checkpointState).toEqual(state);
    });

    it("allows null checkpoint_state for jobs that have not started", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(importJobs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        status: "pending",
        progressPercent: 0,
        checkpointState: null,
        createdAt: now,
        updatedAt: now,
      });

      const rows = await db.select().from(importJobs).where(eq(importJobs.id, id));
      expect(rows[0]?.checkpointState).toBeNull();
    });
  });

  describe("import_entity_refs", () => {
    afterEach(async () => {
      await db.delete(importEntityRefs);
    });

    it("inserts and retrieves a ref", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      await db.insert(importEntityRefs).values({
        id,
        accountId,
        systemId,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "507f1f77bcf86cd799439011",
        pluralscapeEntityId: "mem_test_target_01",
        importedAt: now,
      });

      const rows = await db.select().from(importEntityRefs).where(eq(importEntityRefs.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.sourceEntityId).toBe("507f1f77bcf86cd799439011");
      expect(rows[0]?.pluralscapeEntityId).toBe("mem_test_target_01");
      expect(rows[0]?.source).toBe("simply-plural");
    });

    it("enforces unique (account, system, source, type, sourceId)", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);
      const now = fixtureNow();

      await db.insert(importEntityRefs).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "deadbeefdeadbeefdeadbeef",
        pluralscapeEntityId: "mem_target_a",
        importedAt: now,
      });

      await expect(
        db.insert(importEntityRefs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
          accountId,
          systemId,
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "deadbeefdeadbeefdeadbeef",
          pluralscapeEntityId: "mem_target_b",
          importedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid source via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      await expect(
        db.insert(importEntityRefs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
          accountId,
          systemId,
          source: "not-a-valid-source" as "simply-plural",
          sourceEntityType: "member",
          sourceEntityId: "x",
          pluralscapeEntityId: "y",
          importedAt: fixtureNow(),
        }),
      ).rejects.toThrow();
    });

    it("cascades on system deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      await db.insert(importEntityRefs).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "sys-cascade-check",
        pluralscapeEntityId: "mem_sys_cascade",
        importedAt: fixtureNow(),
      });

      await db.delete(systems).where(eq(systems.id, systemId));

      const remaining = await db
        .select()
        .from(importEntityRefs)
        .where(eq(importEntityRefs.systemId, systemId));
      expect(remaining).toHaveLength(0);
    });

    it("rejects invalid source_entity_type via CHECK constraint", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      await expect(
        db.insert(importEntityRefs).values({
          id: brandId<ImportJobId>(crypto.randomUUID()),
          accountId,
          systemId,
          source: "simply-plural",
          sourceEntityType: "not-a-real-type" as never,
          sourceEntityId: "x",
          pluralscapeEntityId: "y",
          importedAt: fixtureNow(),
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const accountId = await insertAccount();
      const systemId = await insertSystem(accountId);

      await db.insert(importEntityRefs).values({
        id: crypto.randomUUID(),
        accountId,
        systemId,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "abc-cascade",
        pluralscapeEntityId: "mem_cascade_target",
        importedAt: fixtureNow(),
      });

      await db.delete(accounts).where(eq(accounts.id, accountId));

      const remaining = await db
        .select()
        .from(importEntityRefs)
        .where(eq(importEntityRefs.accountId, accountId));
      expect(remaining).toHaveLength(0);
    });
  });
});
