/**
 * SQLite auth schema — sessions table.
 *
 * Covers: sessions (12 tests), partial indexes — sessions (1 test) = 13 tests.
 *
 * Source: schema-sqlite-auth-accounts-sessions.integration.test.ts (lines 295-537)
 */

import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, sessions } from "../schema/sqlite/auth.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { createSqliteAuthTables, testBlob } from "./helpers/sqlite-helpers.js";

import type { AccountId, SessionId, UnixMillis } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const ONE_DAY_MS = 86_400_000;

const schema = { accounts, sessions };

const newSessionId = (): SessionId => brandId<SessionId>(crypto.randomUUID());

describe("SQLite auth schema — sessions", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  function insertAccount(
    overrides: Partial<{
      id: string;
      emailHash: string;
      emailSalt: string;
      authKeyHash: Uint8Array;
      kdfSalt: string;
      createdAt: UnixMillis;
      updatedAt: UnixMillis;
    }> = {},
  ): { id: AccountId } {
    const now = fixtureNow();
    const data = {
      id: brandId<AccountId>(overrides.id ?? crypto.randomUUID()),
      emailHash: overrides.emailHash ?? `hash_${crypto.randomUUID()}`,
      emailSalt: overrides.emailSalt ?? `salt_${crypto.randomUUID()}`,
      authKeyHash: overrides.authKeyHash ?? new Uint8Array(32),
      kdfSalt: overrides.kdfSalt ?? `kdf_${crypto.randomUUID()}`,
      encryptedMasterKey: new Uint8Array(72),
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
    db.insert(accounts).values(data).run();
    return data;
  }

  function insertSession(
    accountId: AccountId,
    overrides: Partial<{ id: SessionId; tokenHash: string; createdAt: UnixMillis }> = {},
  ): { id: SessionId; accountId: AccountId; tokenHash: string; createdAt: UnixMillis } {
    const data = {
      id: overrides.id ?? newSessionId(),
      accountId,
      tokenHash: overrides.tokenHash ?? `tok_${crypto.randomUUID()}`,
      createdAt: overrides.createdAt ?? fixtureNow(),
    };
    db.insert(sessions).values(data).run();
    return data;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteAuthTables(client);
  });

  afterAll(() => {
    client.close();
  });

  describe("sessions", () => {
    it("inserts and retrieves with all fields", () => {
      const account = insertAccount();
      const now = fixtureNow();
      const id = newSessionId();

      const expiresAt = toUnixMillis(now + ONE_DAY_MS);
      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          createdAt: now,
          lastActive: now,
          revoked: false,
          expiresAt,
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(account.id);
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.lastActive).toBe(now);
      expect(rows[0]?.revoked).toBe(false);
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("defaults revoked to false", () => {
      const account = insertAccount();
      const id = newSessionId();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.revoked).toBe(false);
    });

    it("defaults expiresAt to null", () => {
      const account = insertAccount();
      const id = newSessionId();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.expiresAt).toBeNull();
    });

    it("round-trips expiresAt when provided", () => {
      const account = insertAccount();
      const id = newSessionId();
      const expiresAt = toUnixMillis(fixtureNow() + ONE_DAY_MS);

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          createdAt: fixtureNow(),
          expiresAt,
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("handles nullable lastActive", () => {
      const account = insertAccount();
      const id = newSessionId();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.lastActive).toBeNull();
    });

    it("cascades on account deletion", () => {
      const account = insertAccount();
      const id = newSessionId();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          createdAt: fixtureNow(),
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, account.id)).run();
      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects duplicate tokenHash", () => {
      const account = insertAccount();
      const tokenHash = `tok_${crypto.randomUUID()}`;
      insertSession(account.id, { tokenHash });
      expect(() => insertSession(account.id, { tokenHash })).toThrow(/UNIQUE|constraint/i);
    });

    it("rejects nonexistent accountId FK", () => {
      expect(() =>
        db
          .insert(sessions)
          .values({
            id: newSessionId(),
            accountId: brandId<AccountId>("nonexistent"),
            tokenHash: `tok_${crypto.randomUUID()}`,
            createdAt: fixtureNow(),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects expiresAt <= createdAt via CHECK", () => {
      const account = insertAccount();
      const now = fixtureNow();

      expect(() =>
        db
          .insert(sessions)
          .values({
            id: newSessionId(),
            accountId: account.id,
            tokenHash: `tok_${crypto.randomUUID()}`,
            createdAt: now,
            expiresAt: toUnixMillis(now - 1000),
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("rejects expiresAt === createdAt via CHECK (boundary)", () => {
      const account = insertAccount();
      const now = fixtureNow();

      expect(() =>
        db
          .insert(sessions)
          .values({
            id: newSessionId(),
            accountId: account.id,
            tokenHash: `tok_${crypto.randomUUID()}`,
            createdAt: now,
            expiresAt: now,
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("updates expiresAt from null to a value", () => {
      const account = insertAccount();
      const id = newSessionId();
      const now = fixtureNow();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          createdAt: now,
        })
        .run();

      const expiresAt = toUnixMillis(now + ONE_DAY_MS);
      db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("defaults encryptedData to null", () => {
      const account = insertAccount();
      const id = newSessionId();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("round-trips encryptedData blob", () => {
      const account = insertAccount();
      const id = newSessionId();
      const blob = testBlob(new Uint8Array([10, 20, 30]));

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          tokenHash: `tok_${crypto.randomUUID()}`,
          encryptedData: blob,
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.encryptedData).toEqual(blob);
    });
  });

  describe("partial indexes (sessions)", () => {
    it("sessions_expires_at_idx has WHERE expires_at IS NOT NULL", () => {
      const indexes = client
        .prepare(
          `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sessions'`,
        )
        .all() as Array<{ name: string; sql: string | null }>;
      const idx = indexes.find((i) => i.name === "sessions_expires_at_idx");
      expect(idx?.sql).toMatch(/WHERE.*expires_at IS NOT NULL/i);
    });
  });
});
