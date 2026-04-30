import { brandId } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, authKeys } from "../schema/pg/auth.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  insertAccount as insertAccountWith,
  newAccountId,
  newAuthKeyId,
  setupAuthFixture,
  teardownAuthFixture,
  type AuthDb,
} from "./helpers/auth-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { AccountId } from "@pluralscape/types";

describe("PG auth schema — accounts and auth keys", () => {
  let client: PGlite;
  let db: AuthDb;

  const insertAccount = (
    overrides?: Parameters<typeof insertAccountWith>[1],
  ): ReturnType<typeof insertAccountWith> => insertAccountWith(db, overrides);

  beforeAll(async () => {
    const fixture = await setupAuthFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownAuthFixture({ client, db });
  });

  describe("accounts", () => {
    it("inserts and retrieves with all columns", async () => {
      const account = await insertAccount();

      const rows = await db.select().from(accounts).where(eq(accounts.id, account.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(account.id);
      expect(rows[0]?.emailHash).toBe(account.emailHash);
      expect(rows[0]?.emailSalt).toBe(account.emailSalt);
      expect(rows[0]?.authKeyHash).toEqual(account.authKeyHash);
      expect(rows[0]?.kdfSalt).toBe(account.kdfSalt);
      expect(rows[0]?.createdAt).toBe(account.createdAt);
      expect(rows[0]?.updatedAt).toBe(account.updatedAt);
    });

    it("defaults version to 1", async () => {
      const account = await insertAccount();
      const rows = await db.select().from(accounts).where(eq(accounts.id, account.id));
      expect(rows[0]?.version).toBe(1);
    });

    it("rejects duplicate email_hash", async () => {
      const emailHash = `hash_${crypto.randomUUID()}`;
      await insertAccount({ emailHash });
      await expect(insertAccount({ emailHash })).rejects.toThrow();
    });

    it("enforces NOT NULL on required columns", async () => {
      await expect(
        client.query("INSERT INTO accounts (id) VALUES ($1)", [crypto.randomUUID()]),
      ).rejects.toThrow();
    });

    it("rejects duplicate primary key", async () => {
      const id = newAccountId();
      await insertAccount({ id });
      await expect(insertAccount({ id })).rejects.toThrow();
    });

    it("round-trips kdfSalt", async () => {
      const kdfSalt = `kdf_${crypto.randomUUID()}`;
      const account = await insertAccount({ kdfSalt });
      const rows = await db.select().from(accounts).where(eq(accounts.id, account.id));
      expect(rows[0]?.kdfSalt).toBe(kdfSalt);
    });

    it("rejects null kdfSalt", async () => {
      const now = fixtureNow();
      await expect(
        client.query(
          "INSERT INTO accounts (id, email_hash, email_salt, auth_key_hash, kdf_salt, created_at, updated_at, version) VALUES ($1, $2, $3, $4, NULL, $5, $6, 1)",
          [
            crypto.randomUUID(),
            `hash_${crypto.randomUUID()}`,
            `salt_${crypto.randomUUID()}`,
            new Uint8Array(32),
            now,
            now,
          ],
        ),
      ).rejects.toThrow();
    });
  });

  describe("auth_keys", () => {
    it("inserts encryption key and round-trips binary", async () => {
      const account = await insertAccount();
      const privateKey = new Uint8Array([1, 2, 3, 4, 5]);
      const publicKey = new Uint8Array([10, 20, 30, 40, 50]);
      const id = newAuthKeyId();

      await db.insert(authKeys).values({
        id,
        accountId: account.id,
        encryptedPrivateKey: privateKey,
        publicKey,
        keyType: "encryption",
        createdAt: fixtureNow(),
      });

      const rows = await db.select().from(authKeys).where(eq(authKeys.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.keyType).toBe("encryption");
      expect(rows[0]?.encryptedPrivateKey).toEqual(privateKey);
      expect(rows[0]?.publicKey).toEqual(publicKey);
    });

    it("inserts signing key type", async () => {
      const account = await insertAccount();
      const id = newAuthKeyId();

      await db.insert(authKeys).values({
        id,
        accountId: account.id,
        encryptedPrivateKey: new Uint8Array([1]),
        publicKey: new Uint8Array([2]),
        keyType: "signing",
        createdAt: fixtureNow(),
      });

      const rows = await db.select().from(authKeys).where(eq(authKeys.id, id));
      expect(rows[0]?.keyType).toBe("signing");
    });

    it("rejects invalid key_type via CHECK", async () => {
      const account = await insertAccount();
      await expect(
        db.insert(authKeys).values({
          id: newAuthKeyId(),
          accountId: account.id,
          encryptedPrivateKey: new Uint8Array([1]),
          publicKey: new Uint8Array([2]),
          keyType: "invalid" as "encryption",
          createdAt: fixtureNow(),
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const account = await insertAccount();
      const id = newAuthKeyId();

      await db.insert(authKeys).values({
        id,
        accountId: account.id,
        encryptedPrivateKey: new Uint8Array([1]),
        publicKey: new Uint8Array([2]),
        keyType: "encryption",
        createdAt: fixtureNow(),
      });

      await db.delete(accounts).where(eq(accounts.id, account.id));
      const rows = await db.select().from(authKeys).where(eq(authKeys.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent accountId FK", async () => {
      await expect(
        db.insert(authKeys).values({
          id: newAuthKeyId(),
          accountId: brandId<AccountId>("nonexistent"),
          encryptedPrivateKey: new Uint8Array([1]),
          publicKey: new Uint8Array([2]),
          keyType: "encryption",
          createdAt: fixtureNow(),
        }),
      ).rejects.toThrow();
    });

    it("round-trips empty Uint8Array", async () => {
      const account = await insertAccount();
      const id = newAuthKeyId();

      await db.insert(authKeys).values({
        id,
        accountId: account.id,
        encryptedPrivateKey: new Uint8Array(0),
        publicKey: new Uint8Array(0),
        keyType: "encryption",
        createdAt: fixtureNow(),
      });

      const rows = await db.select().from(authKeys).where(eq(authKeys.id, id));
      expect(rows[0]?.encryptedPrivateKey).toEqual(new Uint8Array(0));
      expect(rows[0]?.publicKey).toEqual(new Uint8Array(0));
    });

    it("enforces NOT NULL on required columns", async () => {
      const account = await insertAccount();
      await expect(
        client.query(
          "INSERT INTO auth_keys (id, account_id, key_type, created_at) VALUES ($1, $2, 'encryption', $3)",
          [crypto.randomUUID(), account.id, Date.now()],
        ),
      ).rejects.toThrow();
    });
  });

  describe("partial indexes", () => {
    it("sessions_expires_at_idx has WHERE expires_at IS NOT NULL", async () => {
      const result = await client.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'sessions_expires_at_idx'`,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.indexdef).toMatch(/WHERE.*expires_at IS NOT NULL/i);
    });

    it("recovery_keys_revoked_at_idx has WHERE revoked_at IS NULL", async () => {
      const result = await client.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'recovery_keys_revoked_at_idx'`,
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.indexdef).toMatch(/WHERE.*revoked_at IS NULL/i);
    });
  });

  describe("varchar(50) enforcement", () => {
    it("rejects account ID exceeding 50 characters", async () => {
      const longId = "a".repeat(51);

      await expect(
        client.query(
          `INSERT INTO accounts (id, email_hash, email_salt, auth_key_hash, kdf_salt, encrypted_master_key, created_at, updated_at, version) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 1)`,
          [
            longId,
            `hash_${crypto.randomUUID()}`,
            `salt_${crypto.randomUUID()}`,
            new Uint8Array(32),
            "kdf",
            new Uint8Array(72),
          ],
        ),
      ).rejects.toThrow();
    });

    it("accepts account ID at exactly 50 characters", async () => {
      const exactId = "a".repeat(50);

      await client.query(
        `INSERT INTO accounts (id, email_hash, email_salt, auth_key_hash, kdf_salt, encrypted_master_key, created_at, updated_at, version) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), 1)`,
        [
          exactId,
          `hash_${crypto.randomUUID()}`,
          `salt_${crypto.randomUUID()}`,
          new Uint8Array(32),
          "kdf",
          new Uint8Array(72),
        ],
      );

      const result = await client.query<{ id: string }>(`SELECT id FROM accounts WHERE id = $1`, [
        exactId,
      ]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]?.id).toBe(exactId);

      await client.query(`DELETE FROM accounts WHERE id = $1`, [exactId]);
    });
  });
});
