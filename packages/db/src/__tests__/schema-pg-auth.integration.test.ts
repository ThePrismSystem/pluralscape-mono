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

import { createPgAuthTables } from "./helpers/pg-helpers.js";

import type { PgliteDatabase } from "drizzle-orm/pglite";

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
      createdAt: number;
      updatedAt: number;
    }> = {},
  ): Promise<{
    id: string;
    emailHash: string;
    emailSalt: string;
    passwordHash: string;
    createdAt: number;
    updatedAt: number;
  }> {
    const now = Date.now();
    const data = {
      id: overrides.id ?? crypto.randomUUID(),
      emailHash: overrides.emailHash ?? `hash_${crypto.randomUUID()}`,
      emailSalt: overrides.emailSalt ?? `salt_${crypto.randomUUID()}`,
      passwordHash: overrides.passwordHash ?? `$argon2id$${crypto.randomUUID()}`,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
    await db.insert(accounts).values(data);
    return data;
  }

  async function insertSession(
    accountId: string,
    overrides: Partial<{ id: string; createdAt: number }> = {},
  ): Promise<{ id: string; accountId: string; createdAt: number }> {
    const data = {
      id: overrides.id ?? crypto.randomUUID(),
      accountId,
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

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        deviceInfo: "hashed-device-fingerprint",
        createdAt: now,
        lastActive: now,
        revoked: false,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(account.id);
      expect(rows[0]?.deviceInfo).toBe("hashed-device-fingerprint");
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.lastActive).toBe(now);
      expect(rows[0]?.revoked).toBe(false);
    });

    it("defaults revoked to false", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.revoked).toBe(false);
    });

    it("handles nullable deviceInfo and lastActive", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.deviceInfo).toBeNull();
      expect(rows[0]?.lastActive).toBeNull();
    });

    it("cascades on account deletion", async () => {
      const account = await insertAccount();
      const id = crypto.randomUUID();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: Date.now(),
      });

      await db.delete(accounts).where(eq(accounts.id, account.id));
      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent accountId FK", async () => {
      await expect(
        db.insert(sessions).values({
          id: crypto.randomUUID(),
          accountId: "nonexistent",
          createdAt: Date.now(),
        }),
      ).rejects.toThrow();
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
        createdAt: now,
        expiresAt: now + 3600000,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(account.id);
      expect(rows[0]?.sourceSessionId).toBe(source.id);
      expect(rows[0]?.targetSessionId).toBe(target.id);
      expect(rows[0]?.expiresAt).toBe(now + 3600000);
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
        createdAt: now,
        expiresAt: now + 3600000,
      });

      const rows = await db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id));
      expect(rows[0]?.status).toBe("pending");
    });

    it("accepts approved status", async () => {
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
        createdAt: now,
        expiresAt: now + 3600000,
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
        createdAt: now,
        expiresAt: now + 3600000,
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
          createdAt: now,
          expiresAt: now + 3600000,
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
        createdAt: now,
        expiresAt: now + 3600000,
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
        createdAt: now,
        expiresAt: now + 3600000,
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
          createdAt: now,
          expiresAt: now + 3600000,
        }),
      ).rejects.toThrow();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: crypto.randomUUID(),
          accountId: account.id,
          sourceSessionId: session.id,
          targetSessionId: "nonexistent",
          createdAt: now,
          expiresAt: now + 3600000,
        }),
      ).rejects.toThrow();
    });
  });
});
