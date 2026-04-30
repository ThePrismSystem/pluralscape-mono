/**
 * SQLite auth schema — device_transfer_requests table (lifecycle tests).
 *
 * Covers: device_transfer_requests basic lifecycle — insert, nullable target,
 *   cascade on target deletion, key material, and status fields (8 tests).
 *
 * Source: schema-sqlite-auth-recovery-device.integration.test.ts (lines 219-444)
 * Companion file: schema-sqlite-auth-device-transfer-constraints.integration.test.ts
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

describe("SQLite auth schema — device_transfer_requests (lifecycle)", () => {
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
    it("inserts and retrieves with valid data", () => {
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

    it("accepts targetSessionId as null", () => {
      const account = insertAccount();
      const source = insertSession(account.id);
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: null,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.targetSessionId).toBeNull();
    });

    it("cascades on target session deletion with null-safe FK", () => {
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

      db.delete(sessions).where(eq(sessions.id, target.id)).run();
      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows).toHaveLength(0);
    });

    it("defaults encryptedKeyMaterial to null", () => {
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();
      const keyMaterial = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          encryptedKeyMaterial: keyMaterial,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          status: "approved",
          encryptedKeyMaterial: new Uint8Array([1, 2, 3]),
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      db.insert(deviceTransferRequests)
        .values({
          id,
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          status: "expired",
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
        })
        .run();

      const rows = db
        .select()
        .from(deviceTransferRequests)
        .where(eq(deviceTransferRequests.id, id))
        .all();
      expect(rows[0]?.status).toBe("expired");
    });
  });
});
