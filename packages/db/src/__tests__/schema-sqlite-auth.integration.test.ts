import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  accounts,
  authKeys,
  deviceTransferRequests,
  recoveryKeys,
  sessions,
} from "../schema/sqlite/auth.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const schema = { accounts, authKeys, sessions, recoveryKeys, deviceTransferRequests };

describe("SQLite auth schema", () => {
  let client: InstanceType<typeof Database>;
  let db: BetterSQLite3Database<typeof schema>;

  function insertAccount(
    overrides: Partial<{
      id: string;
      emailHash: string;
      emailSalt: string;
      passwordHash: string;
      createdAt: number;
      updatedAt: number;
    }> = {},
  ): {
    id: string;
    emailHash: string;
    emailSalt: string;
    passwordHash: string;
    createdAt: number;
    updatedAt: number;
  } {
    const now = Date.now();
    const data = {
      id: overrides.id ?? crypto.randomUUID(),
      emailHash: overrides.emailHash ?? `hash_${crypto.randomUUID()}`,
      emailSalt: overrides.emailSalt ?? `salt_${crypto.randomUUID()}`,
      passwordHash: overrides.passwordHash ?? `$argon2id$${crypto.randomUUID()}`,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
    db.insert(accounts).values(data).run();
    return data;
  }

  function insertSession(
    accountId: string,
    overrides: Partial<{ id: string; createdAt: number }> = {},
  ): { id: string; accountId: string; createdAt: number } {
    const data = {
      id: overrides.id ?? crypto.randomUUID(),
      accountId,
      createdAt: overrides.createdAt ?? Date.now(),
    };
    db.insert(sessions).values(data).run();
    return data;
  }

  beforeAll(() => {
    client = new Database(":memory:");
    client.pragma("foreign_keys = ON");
    db = drizzle(client, { schema });

    client.exec(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY,
        email_hash TEXT NOT NULL UNIQUE,
        email_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

    client.exec(`
      CREATE TABLE auth_keys (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        encrypted_private_key BLOB NOT NULL,
        public_key BLOB NOT NULL,
        key_type TEXT NOT NULL CHECK (key_type IN ('encryption', 'signing')),
        created_at INTEGER NOT NULL
      )
    `);

    client.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        device_info TEXT,
        created_at INTEGER NOT NULL,
        last_active INTEGER,
        revoked INTEGER NOT NULL DEFAULT 0
      )
    `);

    client.exec(`
      CREATE TABLE recovery_keys (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        encrypted_master_key BLOB NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    client.exec(`
      CREATE TABLE device_transfer_requests (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        source_session_id TEXT NOT NULL REFERENCES sessions(id),
        target_session_id TEXT NOT NULL REFERENCES sessions(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'expired')),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        CHECK (expires_at > created_at)
      )
    `);
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
      expect(rows[0]?.passwordHash).toBe(account.passwordHash);
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
      expect(() => insertAccount({ emailHash })).toThrow();
    });

    it("enforces NOT NULL on required columns", () => {
      expect(() =>
        client.exec(`INSERT INTO accounts (id) VALUES ('${crypto.randomUUID()}')`),
      ).toThrow();
    });
  });

  describe("auth_keys", () => {
    it("inserts encryption key and round-trips binary", () => {
      const account = insertAccount();
      const privateKey = new Uint8Array([1, 2, 3, 4, 5]);
      const publicKey = new Uint8Array([10, 20, 30, 40, 50]);
      const id = crypto.randomUUID();

      db.insert(authKeys)
        .values({
          id,
          accountId: account.id,
          encryptedPrivateKey: privateKey,
          publicKey,
          keyType: "encryption",
          createdAt: Date.now(),
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
      const id = crypto.randomUUID();

      db.insert(authKeys)
        .values({
          id,
          accountId: account.id,
          encryptedPrivateKey: new Uint8Array([1]),
          publicKey: new Uint8Array([2]),
          keyType: "signing",
          createdAt: Date.now(),
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
            id: crypto.randomUUID(),
            accountId: account.id,
            encryptedPrivateKey: new Uint8Array([1]),
            publicKey: new Uint8Array([2]),
            keyType: "invalid",
            createdAt: Date.now(),
          })
          .run(),
      ).toThrow();
    });

    it("cascades on account deletion", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();

      db.insert(authKeys)
        .values({
          id,
          accountId: account.id,
          encryptedPrivateKey: new Uint8Array([1]),
          publicKey: new Uint8Array([2]),
          keyType: "encryption",
          createdAt: Date.now(),
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, account.id)).run();
      const rows = db.select().from(authKeys).where(eq(authKeys.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("sessions", () => {
    it("inserts and retrieves with all fields", () => {
      const account = insertAccount();
      const now = Date.now();
      const id = crypto.randomUUID();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          deviceInfo: "hashed-device-fingerprint",
          createdAt: now,
          lastActive: now,
          revoked: false,
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(account.id);
      expect(rows[0]?.deviceInfo).toBe("hashed-device-fingerprint");
      expect(rows[0]?.createdAt).toBe(now);
      expect(rows[0]?.lastActive).toBe(now);
      expect(rows[0]?.revoked).toBe(false);
    });

    it("defaults revoked to false", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          createdAt: Date.now(),
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.revoked).toBe(false);
    });

    it("handles nullable deviceInfo and lastActive", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          createdAt: Date.now(),
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.deviceInfo).toBeNull();
      expect(rows[0]?.lastActive).toBeNull();
    });

    it("cascades on account deletion", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          createdAt: Date.now(),
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, account.id)).run();
      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("recovery_keys", () => {
    it("inserts and round-trips binary encrypted_master_key", () => {
      const account = insertAccount();
      const masterKey = new Uint8Array([99, 88, 77, 66, 55, 44, 33, 22, 11]);
      const id = crypto.randomUUID();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: masterKey,
          createdAt: Date.now(),
        })
        .run();

      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedMasterKey).toEqual(masterKey);
    });

    it("cascades on account deletion", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: new Uint8Array([1]),
          createdAt: Date.now(),
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, account.id)).run();
      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows).toHaveLength(0);
    });
  });

  describe("device_transfer_requests", () => {
    it("inserts and retrieves with valid data", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          createdAt: now,
          expiresAt: now + 3600000,
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.accountId).toBe(account.id);
      expect(rows[0]?.sourceSessionId).toBe(source.id);
      expect(rows[0]?.targetSessionId).toBe(target.id);
      expect(rows[0]?.expiresAt).toBe(now + 3600000);
    });

    it("defaults status to pending", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          createdAt: now,
          expiresAt: now + 3600000,
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows[0]?.status).toBe("pending");
    });

    it("rejects invalid status via CHECK", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = Date.now();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: crypto.randomUUID(),
            accountId: account.id,
            sourceSessionId: source.id,
            targetSessionId: target.id,
            status: "invalid",
            createdAt: now,
            expiresAt: now + 3600000,
          })
          .run(),
      ).toThrow();
    });

    it("rejects expires_at <= created_at via CHECK", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = Date.now();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: crypto.randomUUID(),
            accountId: account.id,
            sourceSessionId: source.id,
            targetSessionId: target.id,
            createdAt: now,
            expiresAt: now - 1000,
          })
          .run(),
      ).toThrow();
    });

    it("cascades on account deletion", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          createdAt: now,
          expiresAt: now + 3600000,
        })
        .run();

      db.delete(accounts).where(eq(accounts.id, account.id)).run();
      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("validates both source and target session FKs", () => {
      const account = insertAccount();
      const session = insertSession(account.id);
      const now = Date.now();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: crypto.randomUUID(),
            accountId: account.id,
            sourceSessionId: "nonexistent",
            targetSessionId: session.id,
            createdAt: now,
            expiresAt: now + 3600000,
          })
          .run(),
      ).toThrow();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: crypto.randomUUID(),
            accountId: account.id,
            sourceSessionId: session.id,
            targetSessionId: "nonexistent",
            createdAt: now,
            expiresAt: now + 3600000,
          })
          .run(),
      ).toThrow();
    });
  });
});
