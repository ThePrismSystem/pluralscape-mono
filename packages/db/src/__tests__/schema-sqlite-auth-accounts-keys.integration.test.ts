/**
 * SQLite auth schema — accounts and auth_keys tables.
 *
 * Covers: accounts (7 tests), auth_keys (7 tests) = 14 tests.
 *
 * Source: schema-sqlite-auth-accounts-sessions.integration.test.ts (lines 102-293)
 */

import { brandId } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, authKeys } from "../schema/sqlite/auth.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { createSqliteAuthTables } from "./helpers/sqlite-helpers.js";

import type { AccountId, AuthKeyId, UnixMillis } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, authKeys };

const newAuthKeyId = (): AuthKeyId => brandId<AuthKeyId>(crypto.randomUUID());

describe("SQLite auth schema — accounts and auth_keys", () => {
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
  ): {
    id: AccountId;
    emailHash: string;
    emailSalt: string;
    authKeyHash: Uint8Array;
    kdfSalt: string;
    createdAt: UnixMillis;
    updatedAt: UnixMillis;
  } {
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

  describe("accounts", () => {
    it("inserts and retrieves with all columns", () => {
      const account = insertAccount();

      const rows = db.select().from(accounts).where(eq(accounts.id, account.id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(account.id);
      expect(rows[0]?.emailHash).toBe(account.emailHash);
      expect(rows[0]?.emailSalt).toBe(account.emailSalt);
      expect(rows[0]?.authKeyHash).toEqual(account.authKeyHash);
      expect(rows[0]?.kdfSalt).toBe(account.kdfSalt);
      expect(rows[0]?.createdAt).toBe(account.createdAt);
      expect(rows[0]?.updatedAt).toBe(account.updatedAt);
    });

    it("defaults version to 1", () => {
      const account = insertAccount();
      const rows = db.select().from(accounts).where(eq(accounts.id, account.id)).all();
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects duplicate email_hash", () => {
      const emailHash = `hash_${crypto.randomUUID()}`;
      insertAccount({ emailHash });
      expect(() => insertAccount({ emailHash })).toThrow(/UNIQUE|constraint/i);
    });

    it("enforces NOT NULL on required columns", () => {
      expect(() =>
        client.exec(`INSERT INTO accounts (id) VALUES ('${crypto.randomUUID()}')`),
      ).toThrow(/NOT NULL/i);
    });

    it("rejects duplicate primary key", () => {
      const id = brandId<AccountId>(crypto.randomUUID());
      insertAccount({ id });
      expect(() => insertAccount({ id })).toThrow(/UNIQUE|constraint/i);
    });

    it("round-trips kdfSalt", () => {
      const kdfSalt = `kdf_${crypto.randomUUID()}`;
      const account = insertAccount({ kdfSalt });
      const rows = db.select().from(accounts).where(eq(accounts.id, account.id)).all();
      expect(rows[0]?.kdfSalt).toBe(kdfSalt);
    });

    it("rejects null kdfSalt", () => {
      const now = fixtureNow();
      expect(() =>
        client
          .prepare(
            "INSERT INTO accounts (id, email_hash, email_salt, auth_key_hash, kdf_salt, created_at, updated_at, version) VALUES (?, ?, ?, ?, NULL, ?, ?, 1)",
          )
          .run(
            crypto.randomUUID(),
            `hash_${crypto.randomUUID()}`,
            `salt_${crypto.randomUUID()}`,
            new Uint8Array(32),
            now,
            now,
          ),
      ).toThrow(/NOT NULL/i);
    });
  });

  describe("auth_keys", () => {
    it("inserts encryption key and round-trips binary", () => {
      const account = insertAccount();
      const privateKey = new Uint8Array([1, 2, 3, 4, 5]);
      const publicKey = new Uint8Array([10, 20, 30, 40, 50]);
      const id = newAuthKeyId();

      db.insert(authKeys)
        .values({
          id,
          accountId: account.id,
          encryptedPrivateKey: privateKey,
          publicKey,
          keyType: "encryption",
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(authKeys).where(eq(authKeys.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.keyType).toBe("encryption");
      expect(rows[0]?.encryptedPrivateKey).toEqual(privateKey);
      expect(rows[0]?.publicKey).toEqual(publicKey);
    });

    it("inserts signing key type", () => {
      const account = insertAccount();
      const id = newAuthKeyId();

      db.insert(authKeys)
        .values({
          id,
          accountId: account.id,
          encryptedPrivateKey: new Uint8Array([1]),
          publicKey: new Uint8Array([2]),
          keyType: "signing",
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(authKeys).where(eq(authKeys.id, id)).all();
      expect(rows[0]?.keyType).toBe("signing");
    });

    it("rejects invalid key_type via CHECK", () => {
      const account = insertAccount();
      expect(() =>
        db
          .insert(authKeys)
          .values({
            id: newAuthKeyId(),
            accountId: account.id,
            encryptedPrivateKey: new Uint8Array([1]),
            publicKey: new Uint8Array([2]),
            keyType: "invalid" as "encryption",
            createdAt: fixtureNow(),
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("cascades on account deletion", () => {
      const account = insertAccount();
      const id = newAuthKeyId();

      db.insert(authKeys)
        .values({
          id,
          accountId: account.id,
          encryptedPrivateKey: new Uint8Array([1]),
          publicKey: new Uint8Array([2]),
          keyType: "encryption",
          createdAt: fixtureNow(),
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, account.id)).run();
      const rows = db.select().from(authKeys).where(eq(authKeys.id, id)).all();
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent accountId FK", () => {
      expect(() =>
        db
          .insert(authKeys)
          .values({
            id: newAuthKeyId(),
            accountId: brandId<AccountId>("nonexistent"),
            encryptedPrivateKey: new Uint8Array([1]),
            publicKey: new Uint8Array([2]),
            keyType: "encryption",
            createdAt: fixtureNow(),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips empty Uint8Array", () => {
      const account = insertAccount();
      const id = newAuthKeyId();

      db.insert(authKeys)
        .values({
          id,
          accountId: account.id,
          encryptedPrivateKey: new Uint8Array(0),
          publicKey: new Uint8Array(0),
          keyType: "encryption",
          createdAt: fixtureNow(),
        })
        .run();

      const rows = db.select().from(authKeys).where(eq(authKeys.id, id)).all();
      expect(rows[0]?.encryptedPrivateKey).toEqual(new Uint8Array(0));
      expect(rows[0]?.publicKey).toEqual(new Uint8Array(0));
    });

    it("enforces NOT NULL on required columns", () => {
      const account = insertAccount();
      const now = String(fixtureNow());
      expect(() =>
        client.exec(
          `INSERT INTO auth_keys (id, account_id, key_type, created_at) VALUES ('${crypto.randomUUID()}', '${account.id}', 'encryption', ${now})`,
        ),
      ).toThrow(/NOT NULL/i);
    });
  });
});
