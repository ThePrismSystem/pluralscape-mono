import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  sqliteGetActiveRecoveryKey,
  sqliteReplaceRecoveryKeyBackup,
  sqliteRevokeRecoveryKey,
  sqliteStoreRecoveryKeyBackup,
} from "../queries/recovery-key.js";
import { accounts, recoveryKeys } from "../schema/sqlite/auth.js";

import { fixtureNow, fixtureNowPlus } from "./fixtures/timestamps.js";
import { SQLITE_DDL, sqliteInsertAccount } from "./helpers/sqlite-helpers.js";

import type { AccountId, RecoveryKeyId, UnixMillis } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, recoveryKeys };

describe("recovery key queries (SQLite)", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });
    client.exec(SQLITE_DDL.accounts);
    client.exec(SQLITE_DDL.recoveryKeys);
    client.exec(SQLITE_DDL.recoveryKeysIndexes);
  });

  afterAll(() => {
    client.close();
  });

  afterEach(() => {
    db.delete(recoveryKeys).run();
  });

  function makeEncryptedKey(): Uint8Array {
    // 24-byte nonce + 48-byte ciphertext (realistic AEAD blob)
    return new Uint8Array(72).fill(0xab);
  }

  function makeRow(
    accountId: AccountId,
    overrides: Partial<{ id: RecoveryKeyId; createdAt: UnixMillis }> = {},
  ) {
    return {
      id: overrides.id ?? brandId<RecoveryKeyId>(crypto.randomUUID()),
      accountId,
      encryptedMasterKey: makeEncryptedKey(),
      createdAt: overrides.createdAt ?? fixtureNow(),
    };
  }

  describe("sqliteStoreRecoveryKeyBackup", () => {
    it("inserts a row that can be retrieved", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const row = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, row);

      const all = db.select().from(recoveryKeys).all();
      expect(all).toHaveLength(1);
      expect(all[0]?.id).toBe(row.id);
      expect(all[0]?.accountId).toBe(accountId);
    });

    it("stores encryptedMasterKey bytes faithfully", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const row = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, row);

      const all = db.select().from(recoveryKeys).all();
      expect(all[0]?.encryptedMasterKey).toEqual(row.encryptedMasterKey);
    });
  });

  describe("sqliteGetActiveRecoveryKey", () => {
    it("returns null when no recovery key exists", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const result = sqliteGetActiveRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        accountId,
      );
      expect(result).toBeNull();
    });

    it("returns the active key when one exists", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const row = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, row);

      const result = sqliteGetActiveRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        accountId,
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe(row.id);
    });

    it("returns null when the only key is revoked", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const row = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, row);
      sqliteRevokeRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        row.id,
        fixtureNow(),
      );

      const result = sqliteGetActiveRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        accountId,
      );
      expect(result).toBeNull();
    });

    it("ignores revoked keys and returns active one", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const oldRow = makeRow(accountId, { createdAt: fixtureNowPlus(-10_000) });
      const newRow = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, oldRow);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, newRow);
      sqliteRevokeRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        oldRow.id,
        fixtureNow(),
      );

      const result = sqliteGetActiveRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        accountId,
      );
      expect(result?.id).toBe(newRow.id);
    });
  });

  describe("sqliteRevokeRecoveryKey", () => {
    it("sets revokedAt on the target row", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const row = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, row);

      const revokedAt = fixtureNow();
      sqliteRevokeRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        row.id,
        revokedAt,
      );

      const all = db.select().from(recoveryKeys).all();
      expect(all[0]?.revokedAt).toBe(revokedAt);
    });

    it("throws when revoking nonexistent ID", () => {
      expect(() => {
        sqliteRevokeRecoveryKey(
          db as BetterSQLite3Database<Record<string, unknown>>,
          brandId<RecoveryKeyId>("nonexistent-id"),
          fixtureNow(),
        );
      }).toThrow("Recovery key not found.");
    });

    it("does not affect other rows", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const row1 = makeRow(accountId);
      const row2 = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, row1);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, row2);

      sqliteRevokeRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        row1.id,
        fixtureNow(),
      );

      const all = db.select().from(recoveryKeys).all();
      const r2 = all.find((r) => r.id === row2.id);
      expect(r2?.revokedAt).toBeNull();
    });
  });

  describe("sqliteReplaceRecoveryKeyBackup", () => {
    it("revokes old key and inserts new one atomically", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const oldRow = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, oldRow);

      const newRow = makeRow(accountId);
      const revokedAt = fixtureNow();
      sqliteReplaceRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, {
        revokeId: oldRow.id,
        revokedAt,
        newRow,
      });

      const all = db.select().from(recoveryKeys).all();
      expect(all).toHaveLength(2);

      const old = all.find((r) => r.id === oldRow.id);
      expect(old?.revokedAt).toBe(revokedAt);

      const created = all.find((r) => r.id === newRow.id);
      expect(created?.revokedAt).toBeNull();
    });

    it("throws when revokeId does not exist", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const newRow = makeRow(accountId);
      expect(() => {
        sqliteReplaceRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, {
          revokeId: brandId<RecoveryKeyId>("nonexistent-id"),
          revokedAt: fixtureNow(),
          newRow,
        });
      }).toThrow("Recovery key not found.");
    });

    it("new key is the only active key after replacement", () => {
      const accountId = sqliteInsertAccount(db as BetterSQLite3Database<Record<string, unknown>>);
      const oldRow = makeRow(accountId);
      sqliteStoreRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, oldRow);

      const newRow = makeRow(accountId);
      sqliteReplaceRecoveryKeyBackup(db as BetterSQLite3Database<Record<string, unknown>>, {
        revokeId: oldRow.id,
        revokedAt: fixtureNow(),
        newRow,
      });

      const active = sqliteGetActiveRecoveryKey(
        db as BetterSQLite3Database<Record<string, unknown>>,
        accountId,
      );
      expect(active?.id).toBe(newRow.id);
    });
  });
});
