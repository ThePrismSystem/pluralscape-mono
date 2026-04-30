import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, deviceTransferRequests, sessions } from "../schema/pg/auth.js";

import { fixtureNow } from "./fixtures/timestamps.js";
import {
  insertAccount as insertAccountWith,
  insertSession as insertSessionWith,
  newDeviceTransferRequestId,
  ONE_HOUR_MS,
  setupAuthFixture,
  teardownAuthFixture,
  TEST_CODE_SALT,
  type AuthDb,
} from "./helpers/auth-fixtures.js";

import type { PGlite } from "@electric-sql/pglite";
import type { AccountId, SessionId } from "@pluralscape/types";

describe("PG auth schema — device transfer requests", () => {
  let client: PGlite;
  let db: AuthDb;

  const insertAccount = (
    overrides?: Parameters<typeof insertAccountWith>[1],
  ): ReturnType<typeof insertAccountWith> => insertAccountWith(db, overrides);
  const insertSession = (
    accountId: AccountId,
    overrides?: Parameters<typeof insertSessionWith>[2],
  ): ReturnType<typeof insertSessionWith> => insertSessionWith(db, accountId, overrides);

  beforeAll(async () => {
    const fixture = await setupAuthFixture();
    client = fixture.client;
    db = fixture.db;
  });

  afterAll(async () => {
    await teardownAuthFixture({ client, db });
  });

  describe("device_transfer_requests", () => {
    it("inserts and retrieves with valid data", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: null,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();
      const keyMaterial = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        encryptedKeyMaterial: keyMaterial,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        status: "approved",
        encryptedKeyMaterial: new Uint8Array([1, 2, 3]),
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        status: "expired",
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: newDeviceTransferRequestId(),
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          status: "invalid" as "pending",
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
        }),
      ).rejects.toThrow();
    });

    it("rejects expires_at <= created_at via CHECK", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = fixtureNow();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: newDeviceTransferRequestId(),
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now - 1000),
        }),
      ).rejects.toThrow();
    });

    it("rejects expiresAt === createdAt (boundary of > CHECK)", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = fixtureNow();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: newDeviceTransferRequestId(),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
      const now = fixtureNow();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: newDeviceTransferRequestId(),
          accountId: account.id,
          sourceSessionId: brandId<SessionId>("nonexistent"),
          targetSessionId: session.id,
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
        }),
      ).rejects.toThrow();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: newDeviceTransferRequestId(),
          accountId: account.id,
          sourceSessionId: session.id,
          targetSessionId: brandId<SessionId>("nonexistent"),
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
        }),
      ).rejects.toThrow();
    });

    it("rejects approved status with null encryptedKeyMaterial via CHECK", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = fixtureNow();

      await expect(
        db.insert(deviceTransferRequests).values({
          id: newDeviceTransferRequestId(),
          accountId: account.id,
          sourceSessionId: source.id,
          targetSessionId: target.id,
          status: "approved",
          codeSalt: TEST_CODE_SALT,
          createdAt: now,
          expiresAt: toUnixMillis(now + ONE_HOUR_MS),
        }),
      ).rejects.toThrow();
    });

    it("updates encryptedKeyMaterial from null to binary", async () => {
      const account = await insertAccount();
      const source = await insertSession(account.id);
      const target = await insertSession(account.id);
      const now = fixtureNow();
      const id = newDeviceTransferRequestId();

      await db.insert(deviceTransferRequests).values({
        id,
        accountId: account.id,
        sourceSessionId: source.id,
        targetSessionId: target.id,
        codeSalt: TEST_CODE_SALT,
        createdAt: now,
        expiresAt: toUnixMillis(now + ONE_HOUR_MS),
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
});
