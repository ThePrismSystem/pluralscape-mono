/**
 * SQLite auth schema — recovery_keys table.
 *
 * Covers: recovery_keys (6 tests), partial indexes — recovery_keys (1 test) = 7 tests.
 *
 * Source: schema-sqlite-auth-recovery-device.integration.test.ts (lines 103-215 + 664-675)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, recoveryKeys } from "../schema/sqlite/auth.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { createSqliteAuthTables } from "./helpers/sqlite-helpers.js";

import type { AccountId, RecoveryKeyId, UnixMillis } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, recoveryKeys };

const newRecoveryKeyId = (): RecoveryKeyId => brandId<RecoveryKeyId>(crypto.randomUUID());

describe("SQLite auth schema — recovery_keys", () => {
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

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    createSqliteAuthTables(client);
  });

  afterAll(() => {
    client.close();
  });

  describe("recovery_keys", () => {
    it("inserts and round-trips binary encrypted_master_key", () => {
      const account = insertAccount();
      const masterKey = new Uint8Array([99, 88, 77, 66, 55, 44, 33, 22, 11]);
      const id = newRecoveryKeyId();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: masterKey,
          recoveryKeyHash: new Uint8Array(32),
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedMasterKey).toEqual(masterKey);
    });

    it("defaults revokedAt to null", () => {
      const account = insertAccount();
      const id = newRecoveryKeyId();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: new Uint8Array([1, 2, 3]),
          recoveryKeyHash: new Uint8Array(32),
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("round-trips revokedAt when set", () => {
      const account = insertAccount();
      const id = newRecoveryKeyId();
      const revokedAt = fixtureNow();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: new Uint8Array([1, 2, 3]),
          createdAt: fixtureNow(),
          revokedAt,
        })
        .run();

      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows[0]?.revokedAt).toBe(revokedAt);
    });

    it("cascades on account deletion", () => {
      const account = insertAccount();
      const id = newRecoveryKeyId();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: new Uint8Array([1]),
          recoveryKeyHash: new Uint8Array(32),
          createdAt: fixtureNow(),
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, account.id)).run();
      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent accountId FK", () => {
      expect(() =>
        db
          .insert(recoveryKeys)
          .values({
            id: newRecoveryKeyId(),
            accountId: brandId<AccountId>("nonexistent"),
            encryptedMasterKey: new Uint8Array([1]),
            recoveryKeyHash: new Uint8Array(32),
            createdAt: fixtureNow(),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("updates revokedAt from null to timestamp", () => {
      const account = insertAccount();
      const id = newRecoveryKeyId();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: new Uint8Array([1, 2, 3]),
          recoveryKeyHash: new Uint8Array(32),
          createdAt: fixtureNow(),
        })
        .run();

      const revokedAt = fixtureNow();
      db.update(recoveryKeys).set({ revokedAt }).where(eq(recoveryKeys.id, id)).run();

      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows[0]?.revokedAt).toBe(revokedAt);
    });
  });

  describe("partial indexes", () => {
    it("recovery_keys_revoked_at_idx has WHERE revoked_at IS NULL", () => {
      const indexes = client
        .prepare(
          `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'recovery_keys'`,
        )
        .all() as Array<{ name: string; sql: string | null }>;
      const idx = indexes.find((i) => i.name === "recovery_keys_revoked_at_idx");
      expect(idx?.sql).toMatch(/WHERE.*revoked_at IS NULL/i);
    });
  });
});
