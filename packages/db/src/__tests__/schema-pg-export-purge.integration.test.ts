import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/pg/auth.js";
import { accountPurgeRequests, exportRequests } from "../schema/pg/import-export.js";

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
import type { AccountPurgeRequestId, ImportJobId } from "@pluralscape/types";

describe("PG import-export schema — export & account purge requests", () => {
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
});
