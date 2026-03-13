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

import { createSqliteAuthTables, testBlob } from "./helpers/sqlite-helpers.js";

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const ONE_DAY_MS = 86_400_000;
const ONE_HOUR_MS = 3_600_000;

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
      kdfSalt: string;
      createdAt: number;
      updatedAt: number;
    }> = {},
  ): {
    id: string;
    emailHash: string;
    emailSalt: string;
    passwordHash: string;
    kdfSalt: string;
    createdAt: number;
    updatedAt: number;
  } {
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
      expect(rows[0]?.passwordHash).toBe(account.passwordHash);
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
      const id = crypto.randomUUID();
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
      const now = Date.now();
      expect(() =>
        client
          .prepare(
            "INSERT INTO accounts (id, email_hash, email_salt, password_hash, kdf_salt, created_at, updated_at, version) VALUES (?, ?, ?, ?, NULL, ?, ?, 1)",
          )
          .run(
            crypto.randomUUID(),
            `hash_${crypto.randomUUID()}`,
            `salt_${crypto.randomUUID()}`,
            `pw_${crypto.randomUUID()}`,
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
            keyType: "invalid" as "encryption",
            createdAt: Date.now(),
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
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

    it("rejects nonexistent accountId FK", () => {
      expect(() =>
        db
          .insert(authKeys)
          .values({
            id: crypto.randomUUID(),
            accountId: "nonexistent",
            encryptedPrivateKey: new Uint8Array([1]),
            publicKey: new Uint8Array([2]),
            keyType: "encryption",
            createdAt: Date.now(),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("round-trips empty Uint8Array", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();

      db.insert(authKeys)
        .values({
          id,
          accountId: account.id,
          encryptedPrivateKey: new Uint8Array(0),
          publicKey: new Uint8Array(0),
          keyType: "encryption",
          createdAt: Date.now(),
        })
        .run();

      const rows = db.select().from(authKeys).where(eq(authKeys.id, id)).all();
      expect(rows[0]?.encryptedPrivateKey).toEqual(new Uint8Array(0));
      expect(rows[0]?.publicKey).toEqual(new Uint8Array(0));
    });

    it("enforces NOT NULL on required columns", () => {
      const account = insertAccount();
      const now = String(Date.now());
      expect(() =>
        client.exec(
          `INSERT INTO auth_keys (id, account_id, key_type, created_at) VALUES ('${crypto.randomUUID()}', '${account.id}', 'encryption', ${now})`,
        ),
      ).toThrow(/NOT NULL/i);
    });
  });

  describe("sessions", () => {
    it("inserts and retrieves with all fields", () => {
      const account = insertAccount();
      const now = Date.now();
      const id = crypto.randomUUID();

      const expiresAt = now + ONE_DAY_MS;
      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
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

    it("defaults expiresAt to null", () => {
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
      expect(rows[0]?.expiresAt).toBeNull();
    });

    it("round-trips expiresAt when provided", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();
      const expiresAt = Date.now() + ONE_DAY_MS;

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          createdAt: Date.now(),
          expiresAt,
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("handles nullable lastActive", () => {
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

    it("rejects nonexistent accountId FK", () => {
      expect(() =>
        db
          .insert(sessions)
          .values({
            id: crypto.randomUUID(),
            accountId: "nonexistent",
            createdAt: Date.now(),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects expiresAt <= createdAt via CHECK", () => {
      const account = insertAccount();
      const now = Date.now();

      expect(() =>
        db
          .insert(sessions)
          .values({
            id: crypto.randomUUID(),
            accountId: account.id,
            createdAt: now,
            expiresAt: now - 1000,
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("rejects expiresAt === createdAt via CHECK (boundary)", () => {
      const account = insertAccount();
      const now = Date.now();

      expect(() =>
        db
          .insert(sessions)
          .values({
            id: crypto.randomUUID(),
            accountId: account.id,
            createdAt: now,
            expiresAt: now,
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("updates expiresAt from null to a value", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();
      const now = Date.now();

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          createdAt: now,
        })
        .run();

      const expiresAt = now + ONE_DAY_MS;
      db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("defaults encryptedData to null", () => {
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
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("round-trips encryptedData blob", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();
      const blob = testBlob(new Uint8Array([10, 20, 30]));

      db.insert(sessions)
        .values({
          id,
          accountId: account.id,
          encryptedData: blob,
          createdAt: Date.now(),
        })
        .run();

      const rows = db.select().from(sessions).where(eq(sessions.id, id)).all();
      expect(rows[0]?.encryptedData).toEqual(blob);
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

    it("defaults revokedAt to null", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: new Uint8Array([1, 2, 3]),
          createdAt: Date.now(),
        })
        .run();

      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("round-trips revokedAt when set", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();
      const revokedAt = Date.now();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: new Uint8Array([1, 2, 3]),
          createdAt: Date.now(),
          revokedAt,
        })
        .run();

      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows[0]?.revokedAt).toBe(revokedAt);
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

    it("rejects nonexistent accountId FK", () => {
      expect(() =>
        db
          .insert(recoveryKeys)
          .values({
            id: crypto.randomUUID(),
            accountId: "nonexistent",
            encryptedMasterKey: new Uint8Array([1]),
            createdAt: Date.now(),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("updates revokedAt from null to timestamp", () => {
      const account = insertAccount();
      const id = crypto.randomUUID();

      db.insert(recoveryKeys)
        .values({
          id,
          accountId: account.id,
          encryptedMasterKey: new Uint8Array([1, 2, 3]),
          createdAt: Date.now(),
        })
        .run();

      const revokedAt = Date.now();
      db.update(recoveryKeys).set({ revokedAt }).where(eq(recoveryKeys.id, id)).run();

      const rows = db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id)).all();
      expect(rows[0]?.revokedAt).toBe(revokedAt);
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
          expiresAt: now + ONE_HOUR_MS,
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
      expect(rows[0]?.expiresAt).toBe(now + ONE_HOUR_MS);
    });

    it("defaults encryptedKeyMaterial to null", () => {
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
          expiresAt: now + ONE_HOUR_MS,
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows[0]?.encryptedKeyMaterial).toBeNull();
    });

    it("round-trips encryptedKeyMaterial binary data", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = Date.now();
      const id = crypto.randomUUID();
      const keyMaterial = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          encryptedKeyMaterial: keyMaterial,
          createdAt: now,
          expiresAt: now + ONE_HOUR_MS,
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows[0]?.encryptedKeyMaterial).toEqual(keyMaterial);
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
          expiresAt: now + ONE_HOUR_MS,
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows[0]?.status).toBe("pending");
    });

    it("accepts approved status with encryptedKeyMaterial", () => {
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
          status: "approved",
          encryptedKeyMaterial: new Uint8Array([1, 2, 3]),
          createdAt: now,
          expiresAt: now + ONE_HOUR_MS,
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows[0]?.status).toBe("approved");
    });

    it("accepts expired status", () => {
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
          status: "expired",
          createdAt: now,
          expiresAt: now + ONE_HOUR_MS,
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows[0]?.status).toBe("expired");
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
            status: "invalid" as "pending",
            createdAt: now,
            expiresAt: now + ONE_HOUR_MS,
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
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
      ).toThrow(/constraint|CHECK/i);
    });

    it("rejects expiresAt === createdAt (boundary of > CHECK)", () => {
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
            expiresAt: now,
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
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
          expiresAt: now + ONE_HOUR_MS,
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

    it("cascades on session deletion", () => {
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
          expiresAt: now + ONE_HOUR_MS,
        })
        .run();

      db.delete(sessions).where(eq(sessions.id, source.id)).run();
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
            expiresAt: now + ONE_HOUR_MS,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: crypto.randomUUID(),
            accountId: account.id,
            sourceSessionId: session.id,
            targetSessionId: "nonexistent",
            createdAt: now,
            expiresAt: now + ONE_HOUR_MS,
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects approved status with null encryptedKeyMaterial via CHECK", () => {
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
            status: "approved",
            createdAt: now,
            expiresAt: now + ONE_HOUR_MS,
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("updates encryptedKeyMaterial from null to binary", () => {
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
          expiresAt: now + ONE_HOUR_MS,
        })
        .run();

      const keyMaterial = new Uint8Array([10, 20, 30, 40]);
      db.update(deviceTransferRequests)
        .set({ encryptedKeyMaterial: keyMaterial })
        .where(eq(deviceTransferRequests.id, id))
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows[0]?.encryptedKeyMaterial).toEqual(keyMaterial);
    });
  });

  describe("partial indexes", () => {
    it("sessions_expires_at_idx has WHERE expires_at IS NOT NULL", () => {
      const indexes = client
        .prepare(
          `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sessions'`,
        )
        .all() as Array<{ name: string; sql: string | null }>;
      const idx = indexes.find((i) => i.name === "sessions_expires_at_idx");
      expect(idx).toBeDefined();
      expect(idx?.sql).toMatch(/WHERE.*expires_at IS NOT NULL/i);
    });

    it("recovery_keys_revoked_at_idx has WHERE revoked_at IS NULL", () => {
      const indexes = client
        .prepare(
          `SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'recovery_keys'`,
        )
        .all() as Array<{ name: string; sql: string | null }>;
      const idx = indexes.find((i) => i.name === "recovery_keys_revoked_at_idx");
      expect(idx).toBeDefined();
      expect(idx?.sql).toMatch(/WHERE.*revoked_at IS NULL/i);
    });
  });
});
