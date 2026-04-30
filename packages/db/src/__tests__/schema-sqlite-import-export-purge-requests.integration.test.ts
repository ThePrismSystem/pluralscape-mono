/**
 * SQLite import-export schema — account_purge_requests table.
 *
 * Covers: account_purge_requests (8 tests).
 *
 * Source: schema-sqlite-import-export-requests.integration.test.ts (lines 275-530)
 */

import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { accounts } from "../schema/sqlite/auth.js";
import { accountPurgeRequests } from "../schema/sqlite/import-export.js";
import { systems } from "../schema/sqlite/systems.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  createSqliteImportExportTables,
  sqliteInsertAccount,
  sqliteInsertSystem,
} from "./helpers/sqlite-helpers.js";

import type { ImportJobId } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, systems, accountPurgeRequests };

describe("SQLite import-export schema — account_purge_requests", () => {
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
    db.delete(accountPurgeRequests).run();
  });

  describe("account_purge_requests", () => {
    it("round-trips with all fields", () => {
      const accountId = insertAccount();
      // insertSystem required to ensure FK chain, but purge doesn't reference system directly
      insertSystem(accountId);
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(accountPurgeRequests)
        .values({
          id,
          accountId,
          status: "confirmed",
          confirmationPhrase: "DELETE MY ACCOUNT",
          scheduledPurgeAt: toUnixMillis(now + 86400000),
          requestedAt: now,
          confirmedAt: toUnixMillis(now + 1000),
          completedAt: toUnixMillis(now + 86400000),
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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(accountPurgeRequests)
          .values({
            id: brandId<ImportJobId>(crypto.randomUUID()),
            accountId,
            status: "invalid-status" as "pending",
            confirmationPhrase: "DELETE MY ACCOUNT",
            scheduledPurgeAt: toUnixMillis(now + 86400000),
            requestedAt: now,
          })
          .run(),
      ).toThrow();
    });

    it("applies default status of pending", () => {
      const accountId = insertAccount();
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

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
      const id = brandId<ImportJobId>(crypto.randomUUID());
      const now = fixtureNow();

      db.insert(accountPurgeRequests)
        .values({
          id,
          accountId,
          status: "pending",
          confirmationPhrase: "CONFIRM DELETE",
          scheduledPurgeAt: toUnixMillis(now + 86400000),
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
      const now = fixtureNow();
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
            id: brandId<ImportJobId>(crypto.randomUUID()),
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
      const now = fixtureNow();
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
      const now = fixtureNow();
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
      const now = fixtureNow();
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
            id: brandId<ImportJobId>(crypto.randomUUID()),
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
