import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  accounts,
  authKeys,
  deviceTransferRequests,
  recoveryKeys,
  sessions,
} from "../schema/pg/auth.js";

import { createPgAuthTables, testBlob } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

const ONE_DAY_MS = 86_400_000;
const ONE_HOUR_MS = 3_600_000;
/** 16-byte salt for device transfer test inserts. */
const TEST_CODE_SALT = new Uint8Array(16);

const schema = { accounts, authKeys, sessions, recoveryKeys, deviceTransferRequests };

describe("PG auth schema", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  async function insertAccount(
    overrides: Partial<{
      id: string;
      emailHash: string;
      emailSalt: string;
      passwordHash: string;
      kdfSalt: string;
      createdAt: number;
      updatedAt: number;
    }> = {},
  ): Promise<{
    id: string;
    emailHash: string;
    emailSalt: string;
    passwordHash: string;
    kdfSalt: string;
    createdAt: number;
    updatedAt: number;
  }> {
    const now = Date.now();
    const data = {
      id: overrides.id ?? crypto.randomUUID(),
      emailHash: overrides.emailHash ?? `hash_${crypto.randomUUID()}`,
      emailSalt: overrides.emailSalt ?? `salt_${crypto.randomUUID()}`,
      passwordHash: overrides.passwordHash ?? `$argon2id$${crypto.randomUUID()}`,
      kdfSalt: overrides.kdfSalt ?? `kdf_${crypto.randomUUID()}`,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
    await db.insert(accounts).values(data);
    return data;
  }

  async function insertSession(
    accountId: string,
    overrides: Partial<{ id: string; createdAt: number; tokenHash: string }> = {},
  ): Promise<{ id: string; accountId: string; tokenHash: string; createdAt: number }> {
    const data = {
      id: overrides.id ?? crypto.randomUUID(),
      accountId,
      tokenHash: overrides.tokenHash ?? `tok_${crypto.randomUUID()}`,
      createdAt: overrides.createdAt ?? Date.now(),
    };
    await db.insert(sessions).values(data);
    return data;
  }

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgAuthTables(client);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("accounts", () => {
    it("inserts and retrieves with all columns", async () => {
      const account = await insertAccount();

      const rows = await db.select().from(accounts).where(eq(accounts.id, account.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(account.id);
      expect(rows[0]?.emailHash).toBe(account.emailHash);
      expect(rows[0]?.emailSalt).toBe(account.emailSalt);
      expect(rows[0]?.passwordHash).toBe(account.passwordHash);
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
      const id = crypto.randomUUID();
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
      const now = Date.now();
      await expect(
        client.query(
          "INSERT INTO accounts (id, email_hash, email_salt, password_hash, kdf_salt, created_at, updated_at, version) VALUES ($1, $2, $3, $4, NULL, $5, $6, 1)",
          [
            crypto.randomUUID(),
            `hash_${crypto.randomUUID()}`,
            `salt_${crypto.randomUUID()}`,
            `$argon2id$${crypto.randomUUID()}`,
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
      const id = crypto.randomUUID();

      await db.insert(authKeys).values({
        id,
        accountId: account.id,
        encryptedPrivateKey: privateKey,
        publicKey,
        keyType: "encryption",
        createdAt: Date.now(),
      });

      const rows = await db.select().from(authKeys).where(eq(authKeys.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.keyType).toBe("encryption");
      expect(rows[0]?.encryptedPrivateKey).toEqual(privateKey);
      expect(rows[0]?.publicKey).toEqual(publicKey);
    });

    it("inserts signing key type", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(authKeys).values({
        id,
        accountId: account.id,
        encryptedPrivateKey: new Uint8Array([1]),
        publicKey: new Uint8Array([2]),
        keyType: "signing",
        createdAt: Date.now(),
      });

      const rows = await db.select().from(authKeys).where(eq(authKeys.id, id));
      expect(rows[0]?.keyType).toBe("signing");
    });

    it("rejects invalid key_type via CHECK", async () => {
      const account = await insertAccount();
      await expect(
        db.insert(authKeys).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          encryptedPrivateKey: new Uint8Array([1]),
          publicKey: new Uint8Array([2]),
          keyType: "invalid" as "encryption",
          createdAt: Date.now(),
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(authKeys).values({
        id,
        accountId: account.id,
        encryptedPrivateKey: new Uint8Array([1]),
        publicKey: new Uint8Array([2]),
        keyType: "encryption",
        createdAt: Date.now(),
      });

      await db.delete(accounts).where(eq(accounts.id, account.id));
      const rows = await db.select().from(authKeys).where(eq(authKeys.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent accountId FK", async () => {
      await expect(
        db.insert(authKeys).values({
          id: crypto.randomUUID(),
          accountId: "nonexistent",
          encryptedPrivateKey: new Uint8Array([1]),
          publicKey: new Uint8Array([2]),
          keyType: "encryption",
          createdAt: Date.now(),
        }),
      ).rejects.toThrow();
    });

    it("round-trips empty Uint8Array", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(authKeys).values({
        id,
        accountId: account.id,
        encryptedPrivateKey: new Uint8Array(0),
        publicKey: new Uint8Array(0),
        keyType: "encryption",
        createdAt: Date.now(),
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

  describe("sessions", () => {
    it("inserts and retrieves with all fields", async () => {
      const account = await insertAccount();
      const now = Date.now();
      const id = crypto.randomUUID();

      const expiresAt = now + ONE_DAY_MS;
      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: now,
        lastActive: now,
        revoked: false,
        expiresAt,
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(account.id);
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.lastActive).toBe(now);
      expect(rows[0]?.revoked).toBe(false);
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("defaults revoked to false", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.revoked).toBe(false);
    });

    it("defaults expiresAt to null", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.expiresAt).toBeNull();
    });

    it("round-trips expiresAt when provided", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();
      const expiresAt = Date.now() + ONE_DAY_MS;

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
        expiresAt,
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("handles nullable lastActive", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.lastActive).toBeNull();
    });

    it("cascades on account deletion", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      await db.delete(accounts).where(eq(accounts.id, account.id));
      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects duplicate tokenHash", async () => {
      const account = await insertAccount();
      const tokenHash = `tok_${crypto.randomUUID()}`;
      await insertSession(account.id, { tokenHash });
      await expect(insertSession(account.id, { tokenHash })).rejects.toThrow();
    });

    it("rejects nonexistent accountId FK", async () => {
      await expect(
        db.insert(sessions).values({
          id: crypto.randomUUID(),
          accountId: "nonexistent",
          createdAt: Date.now(),
          tokenHash: `tok_${crypto.randomUUID()}`,
        }),
      ).rejects.toThrow();
    });

    it("rejects expiresAt <= createdAt via CHECK", async () => {
      const account = await insertAccount();
      const now = Date.now();

      await expect(
        db.insert(sessions).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          createdAt: now,
          expiresAt: now - 1000,
          tokenHash: `tok_${crypto.randomUUID()}`,
        }),
      ).rejects.toThrow();
    });

    it("rejects expiresAt === createdAt via CHECK (boundary)", async () => {
      const account = await insertAccount();
      const now = Date.now();

      await expect(
        db.insert(sessions).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          createdAt: now,
          expiresAt: now,
          tokenHash: `tok_${crypto.randomUUID()}`,
        }),
      ).rejects.toThrow();
    });

    it("updates expiresAt from null to a value", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: now,
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const expiresAt = now + ONE_DAY_MS;
      await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("defaults encryptedData to null", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("round-trips encryptedData blob", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();
      const blob = testBlob(new Uint8Array([10, 20, 30]));

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        encryptedData: blob,
        createdAt: Date.now(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.encryptedData).toEqual(blob);
    });
  });

  describe("recovery_keys", () => {
    it("inserts and round-trips binary encrypted_master_key", async () => {
      const account = await insertAccount();
      const masterKey = new Uint8Array([99, 88, 77, 66, 55, 44, 33, 22, 11]);
      const id = crypto.randomUUID();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: masterKey,
        createdAt: Date.now(),
      });

      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedMasterKey).toEqual(masterKey);
    });

    it("defaults revokedAt to null", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: new Uint8Array([1, 2, 3]),
        createdAt: Date.now(),
      });

      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("round-trips revokedAt when set", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();
      const revokedAt = Date.now();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: new Uint8Array([1, 2, 3]),
        createdAt: Date.now(),
        revokedAt,
      });

      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows[0]?.revokedAt).toBe(revokedAt);
    });

    it("cascades on account deletion", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: new Uint8Array([1]),
        createdAt: Date.now(),
      });

      await db.delete(accounts).where(eq(accounts.id, account.id));
      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent accountId FK", async () => {
      await expect(
        db.insert(recoveryKeys).values({
          id: crypto.randomUUID(),
          accountId: "nonexistent",
          encryptedMasterKey: new Uint8Array([1]),
          createdAt: Date.now(),
        }),
      ).rejects.toThrow();
    });

    it("updates revokedAt from null to timestamp", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: new Uint8Array([1, 2, 3]),
        createdAt: Date.now(),
      });

      const revokedAt = Date.now();
      await db.update(recoveryKeys).set({ revokedAt }).where(eq(recoveryKeys.id, id));

      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows[0]?.revokedAt).toBe(revokedAt);
    });
  });

  describe("device_transfer_requests", () => {
    it("inserts and retrieves with valid data", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(account.id);
      expect(rows[0]?.sourceSessionId).toBe(source.id);
      expect(rows[0]?.targetSessionId).toBe(target.id);
      expect(rows[0]?.expiresAt).toBe(now + ONE_HOUR_MS);
    });

    it("accepts targetSessionId as null", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: null,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.targetSessionId).toBeNull();
    });

    it("defaults encryptedKeyMaterial to null", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows[0]?.encryptedKeyMaterial).toBeNull();
    });

    it("round-trips encryptedKeyMaterial binary data", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();
      const keyMaterial = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        encryptedKeyMaterial: keyMaterial,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows[0]?.encryptedKeyMaterial).toEqual(keyMaterial);
    });

    it("defaults status to pending", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows[0]?.status).toBe("pending");
    });

    it("accepts approved status with encryptedKeyMaterial", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        status: "approved",
        encryptedKeyMaterial: new Uint8Array([1, 2, 3]),
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows[0]?.status).toBe("approved");
    });

    it("accepts expired status", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        status: "expired",
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows[0]?.status).toBe("expired");
    });

    it("rejects invalid status via CHECK", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          status: "invalid" as "pending",
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: now + ONE_HOUR_MS,
        }),
      ).rejects.toThrow();
    });

    it("rejects expires_at <= created_at via CHECK", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: now - 1000,
        }),
      ).rejects.toThrow();
    });

    it("rejects expiresAt === createdAt (boundary of > CHECK)", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: now,
        }),
      ).rejects.toThrow();
    });

    it("cascades on account deletion", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      await db.delete(accounts).where(eq(accounts.id, account.id));
      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows).toHaveLength(0);
    });

    it("cascades on session deletion", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      await db.delete(sessions).where(eq(sessions.id, source.id));
      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows).toHaveLength(0);
    });

    it("validates both source and target session FKs", async () => {
      const account = await insertAccount();
      const session = await insertSession(account.id);
      const now = Date.now();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          sourceSessionId: "nonexistent",
          targetSessionId: session.id,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: now + ONE_HOUR_MS,
        }),
      ).rejects.toThrow();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          sourceSessionId: session.id,
          targetSessionId: "nonexistent",
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: now + ONE_HOUR_MS,
        }),
      ).rejects.toThrow();
    });

    it("rejects approved status with null encryptedKeyMaterial via CHECK", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          status: "approved",
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: now + ONE_HOUR_MS,
        }),
      ).rejects.toThrow();
    });

    it("updates encryptedKeyMaterial from null to binary", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: now + ONE_HOUR_MS,
      });

      const keyMaterial = new Uint8Array([10, 20, 30, 40]);
      await db
        .update(deviceTransferRequests)
        .set({ encryptedKeyMaterial: keyMaterial })
        .where(eq(deviceTransferRequests.id, id));

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows[0]?.encryptedKeyMaterial).toEqual(keyMaterial);
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
          `INSERT INTO accounts (id, email_hash, email_salt, password_hash, kdf_salt, created_at, updated_at, version) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 1)`,
          [longId, `hash_${crypto.randomUUID()}`, `salt_${crypto.randomUUID()}`, "pw_hash", "kdf"],
        ),
      ).rejects.toThrow();
    });

    it("accepts account ID at exactly 50 characters", async () => {
      const exactId = "a".repeat(50);

      await client.query(
        `INSERT INTO accounts (id, email_hash, email_salt, password_hash, kdf_salt, created_at, updated_at, version) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), 1)`,
        [exactId, `hash_${crypto.randomUUID()}`, `salt_${crypto.randomUUID()}`, "pw_hash", "kdf"],
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
