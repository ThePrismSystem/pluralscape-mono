import { brandId, toUnixMillis } from "@pluralscape/types";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { accounts, recoveryKeys, sessions } from "../schema/pg/auth.js";

import { fixtureNow, fixtureNowPlus } from "./fixtures/timestamps.js";
import {
  insertAccount as insertAccountWith,
  insertSession as insertSessionWith,
  newRecoveryKeyId,
  newSessionId,
  ONE_DAY_MS,
  setupAuthFixture,
  teardownAuthFixture,
  type AuthDb,
} from "./helpers/auth-fixtures.js";
import { testBlob } from "./helpers/pg-helpers.js";

import type { PGlite } from "@electric-sql/pglite";
import type { AccountId } from "@pluralscape/types";

describe("PG auth schema — sessions and recovery keys", () => {
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

  describe("sessions", () => {
    it("inserts and retrieves with all fields", async () => {
      const account = await insertAccount();
      const now = fixtureNow();
      const id = newSessionId();

      const expiresAt = toUnixMillis(now + ONE_DAY_MS);
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
      const id = newSessionId();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: fixtureNow(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.revoked).toBe(false);
    });

    it("defaults expiresAt to null", async () => {
      const account = await insertAccount();
      const id = newSessionId();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: fixtureNow(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.expiresAt).toBeNull();
    });

    it("round-trips expiresAt when provided", async () => {
      const account = await insertAccount();
      const id = newSessionId();
      const expiresAt = fixtureNowPlus(ONE_DAY_MS);

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: fixtureNow(),
        expiresAt,
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("handles nullable lastActive", async () => {
      const account = await insertAccount();
      const id = newSessionId();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: fixtureNow(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.lastActive).toBeNull();
    });

    it("cascades on account deletion", async () => {
      const account = await insertAccount();
      const id = newSessionId();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: fixtureNow(),
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
          id: newSessionId(),
          accountId: brandId<AccountId>("nonexistent"),
          createdAt: fixtureNow(),
          tokenHash: `tok_${crypto.randomUUID()}`,
        }),
      ).rejects.toThrow();
    });

    it("rejects expiresAt <= createdAt via CHECK", async () => {
      const account = await insertAccount();
      const now = fixtureNow();

      await expect(
        db.insert(sessions).values({
          id: newSessionId(),
          accountId: account.id,
          createdAt: now,
          expiresAt: toUnixMillis(now - 1000),
          tokenHash: `tok_${crypto.randomUUID()}`,
        }),
      ).rejects.toThrow();
    });

    it("rejects expiresAt === createdAt via CHECK (boundary)", async () => {
      const account = await insertAccount();
      const now = fixtureNow();

      await expect(
        db.insert(sessions).values({
          id: newSessionId(),
          accountId: account.id,
          createdAt: now,
          expiresAt: now,
          tokenHash: `tok_${crypto.randomUUID()}`,
        }),
      ).rejects.toThrow();
    });

    it("updates expiresAt from null to a value", async () => {
      const account = await insertAccount();
      const id = newSessionId();
      const now = fixtureNow();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: now,
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const expiresAt = toUnixMillis(now + ONE_DAY_MS);
      await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.expiresAt).toBe(expiresAt);
    });

    it("defaults encryptedData to null", async () => {
      const account = await insertAccount();
      const id = newSessionId();

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        createdAt: fixtureNow(),
        tokenHash: `tok_${crypto.randomUUID()}`,
      });

      const rows = await db.select().from(sessions).where(eq(sessions.id, id));
      expect(rows[0]?.encryptedData).toBeNull();
    });

    it("round-trips encryptedData blob", async () => {
      const account = await insertAccount();
      const id = newSessionId();
      const blob = testBlob(new Uint8Array([10, 20, 30]));

      await db.insert(sessions).values({
        id,
        accountId: account.id,
        encryptedData: blob,
        createdAt: fixtureNow(),
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
      const id = newRecoveryKeyId();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: masterKey,
        recoveryKeyHash: new Uint8Array(32),
        createdAt: fixtureNow(),
      });

      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.encryptedMasterKey).toEqual(masterKey);
    });

    it("defaults revokedAt to null", async () => {
      const account = await insertAccount();
      const id = newRecoveryKeyId();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: new Uint8Array([1, 2, 3]),
        recoveryKeyHash: new Uint8Array(32),
        createdAt: fixtureNow(),
      });

      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows[0]?.revokedAt).toBeNull();
    });

    it("round-trips revokedAt when set", async () => {
      const account = await insertAccount();
      const id = newRecoveryKeyId();
      const revokedAt = fixtureNow();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: new Uint8Array([1, 2, 3]),
        createdAt: fixtureNow(),
        revokedAt,
      });

      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows[0]?.revokedAt).toBe(revokedAt);
    });

    it("cascades on account deletion", async () => {
      const account = await insertAccount();
      const id = newRecoveryKeyId();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: new Uint8Array([1]),
        recoveryKeyHash: new Uint8Array(32),
        createdAt: fixtureNow(),
      });

      await db.delete(accounts).where(eq(accounts.id, account.id));
      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows).toHaveLength(0);
    });

    it("rejects nonexistent accountId FK", async () => {
      await expect(
        db.insert(recoveryKeys).values({
          id: newRecoveryKeyId(),
          accountId: brandId<AccountId>("nonexistent"),
          encryptedMasterKey: new Uint8Array([1]),
          recoveryKeyHash: new Uint8Array(32),
          createdAt: fixtureNow(),
        }),
      ).rejects.toThrow();
    });

    it("updates revokedAt from null to timestamp", async () => {
      const account = await insertAccount();
      const id = newRecoveryKeyId();

      await db.insert(recoveryKeys).values({
        id,
        accountId: account.id,
        encryptedMasterKey: new Uint8Array([1, 2, 3]),
        recoveryKeyHash: new Uint8Array(32),
        createdAt: fixtureNow(),
      });

      const revokedAt = fixtureNow();
      await db.update(recoveryKeys).set({ revokedAt }).where(eq(recoveryKeys.id, id));

      const rows = await db.select().from(recoveryKeys).where(eq(recoveryKeys.id, id));
      expect(rows[0]?.revokedAt).toBe(revokedAt);
    });
  });
});
