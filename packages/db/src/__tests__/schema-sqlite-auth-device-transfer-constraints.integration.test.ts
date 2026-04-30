/**
 * SQLite auth schema — device_transfer_requests table (constraint tests).
 *
 * Covers: device_transfer_requests CHECK constraints, cascade deletions,
 *   FK validation, and key material update (8 tests).
 *
 * Source: schema-sqlite-auth-recovery-device.integration.test.ts (lines 446-660)
 * Companion file: schema-sqlite-auth-device-transfer.integration.test.ts
 */

import { brandId, toUnixMillis } from "@pluralscape/types";
import Database from "better-sqlite3-multiple-ciphers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, deviceTransferRequests, sessions } from "../schema/sqlite/auth.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import { createSqliteAuthTables } from "./helpers/sqlite-helpers.js";

import type { AccountId, DeviceTransferRequestId, SessionId, UnixMillis } from "@pluralscape/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

const ONE_HOUR_MS = 3_600_000;
/** 16-byte salt for device transfer test inserts. */
const TEST_CODE_SALT = new Uint8Array(16);

const schema = { accounts, sessions, deviceTransferRequests };

const newSessionId = (): SessionId => brandId<SessionId>(crypto.randomUUID());
const newDeviceTransferRequestId = (): DeviceTransferRequestId =>
  brandId<DeviceTransferRequestId>(crypto.randomUUID());

describe("SQLite auth schema — device_transfer_requests (constraints)", () => {
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

  describe("device_transfer_requests", () => {
    it("rejects invalid status via CHECK", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: newDeviceTransferRequestId(),
            accountId: account.id,
            sourceSessionId: source.id,
            targetSessionId: target.id,
            status: "invalid" as "pending",
            codeSalt: TEST_CODE_SALT,
            createdAt: now,
            expiresAt: toUnixMillis(now + ONE_HOUR_MS),
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("rejects expires_at <= created_at via CHECK", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: newDeviceTransferRequestId(),
            accountId: account.id,
            sourceSessionId: source.id,
            targetSessionId: target.id,
            codeSalt: TEST_CODE_SALT,
            createdAt: now,
            expiresAt: toUnixMillis(now - 1000),
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("rejects expiresAt === createdAt (boundary of > CHECK)", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: newDeviceTransferRequestId(),
            accountId: account.id,
            sourceSessionId: source.id,
            targetSessionId: target.id,
            codeSalt: TEST_CODE_SALT,
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: newDeviceTransferRequestId(),
            accountId: account.id,
            sourceSessionId: brandId<SessionId>("nonexistent"),
            targetSessionId: session.id,
            codeSalt: TEST_CODE_SALT,
            createdAt: now,
            expiresAt: toUnixMillis(now + ONE_HOUR_MS),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: newDeviceTransferRequestId(),
            accountId: account.id,
            sourceSessionId: session.id,
            targetSessionId: brandId<SessionId>("nonexistent"),
            codeSalt: TEST_CODE_SALT,
            createdAt: now,
            expiresAt: toUnixMillis(now + ONE_HOUR_MS),
          })
          .run(),
      ).toThrow(/FOREIGN KEY|constraint/i);
    });

    it("rejects approved status with null encryptedKeyMaterial via CHECK", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = fixtureNow();

      expect(() =>
        db
          .insert(deviceTransferRequests)
          .values({
            id: newDeviceTransferRequestId(),
            accountId: account.id,
            sourceSessionId: source.id,
            targetSessionId: target.id,
            status: "approved",
            codeSalt: TEST_CODE_SALT,
            createdAt: now,
            expiresAt: toUnixMillis(now + ONE_HOUR_MS),
          })
          .run(),
      ).toThrow(/constraint|CHECK/i);
    });

    it("updates encryptedKeyMaterial from null to binary", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const target = insertSession(account.id);
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
});
