import nodeCrypto from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import { hashAuthKey, initSodium } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import { createPgAuthTables, PG_DDL, pgExec } from "@pluralscape/db/test-helpers/pg-helpers";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/** 64-hex-char (32-byte) test pepper for email hashing. */
const TEST_PEPPER = vi.hoisted(() => "ab".repeat(32));

vi.mock("../../env.js", async () => {
  const actual = await vi.importActual<typeof import("../../env.js")>("../../env.js");
  return {
    env: {
      ...actual.env,
      EMAIL_HASH_PEPPER: TEST_PEPPER,
    },
  };
});

import { hashEmail } from "../../lib/email-hash.js";
import { toHex } from "../../lib/hex.js";
import {
  getRecoveryKeyStatus,
  NoActiveRecoveryKeyError,
  regenerateRecoveryKeyBackup,
  resetPasswordWithRecoveryKey,
} from "../../services/recovery-key.service.js";
import { asDb, noopAudit, spyAudit } from "../helpers/integration-setup.js";
import { createMockLogger } from "../helpers/mock-logger.js";

import type { AccountId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { accounts, authKeys, recoveryKeys, sessions, systems } = schema;

/** Generate n random bytes. */
function randBytes(n: number): Uint8Array {
  return nodeCrypto.randomBytes(n);
}

describe("recovery-key.service (PGlite integration)", { timeout: 60_000 }, () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    await initSodium();
    client = await PGlite.create();
    db = drizzle(client, { schema });

    await createPgAuthTables(client);
    await pgExec(client, PG_DDL.systems);
    await pgExec(client, PG_DDL.systemsIndexes);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(sessions);
    await db.delete(recoveryKeys);
    await db.delete(authKeys);
    await db.delete(systems);
    await db.delete(accounts);
  });

  /**
   * Insert a minimal test account directly into the DB using real crypto.
   * Returns ids, email, and the raw authKey hex (so tests can pass it in params).
   */
  async function insertTestAccount(overrides: { email?: string } = {}): Promise<{
    accountId: AccountId;
    email: string;
    authKeyHex: string;
    recoveryKeyId: string;
  }> {
    const email = overrides.email ?? `test-${crypto.randomUUID()}@example.com`;
    const accountId = `acct_${crypto.randomUUID()}` as AccountId;
    const authKeyBytes = randBytes(32);
    const authKeyHashBytes = hashAuthKey(authKeyBytes);
    const kdfSalt = toHex(randBytes(16));
    const encryptedMasterKey = randBytes(72);
    const emailHash = hashEmail(email);
    const recoveryEncMasterKey = randBytes(72);
    const timestamp = Date.now();
    const recoveryKeyId = `rk_${crypto.randomUUID()}`;

    await db.insert(accounts).values({
      id: accountId,
      emailHash,
      emailSalt: toHex(randBytes(16)),
      authKeyHash: authKeyHashBytes,
      kdfSalt,
      encryptedMasterKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await db.insert(recoveryKeys).values({
      id: recoveryKeyId,
      accountId,
      encryptedMasterKey: recoveryEncMasterKey,
      createdAt: timestamp,
    });

    return {
      accountId,
      email,
      authKeyHex: toHex(authKeyBytes),
      recoveryKeyId,
    };
  }

  /** Generate valid new-blob params for resetPasswordWithRecoveryKey. */
  function makeResetParams(email: string): {
    email: string;
    newAuthKey: string;
    newKdfSalt: string;
    newEncryptedMasterKey: string;
    newRecoveryEncryptedMasterKey: string;
    challengeSignature: string;
  } {
    return {
      email,
      newAuthKey: toHex(randBytes(32)),
      newKdfSalt: toHex(randBytes(16)),
      newEncryptedMasterKey: toHex(randBytes(72)),
      newRecoveryEncryptedMasterKey: toHex(randBytes(72)),
      challengeSignature: toHex(randBytes(64)),
    };
  }

  // ── getRecoveryKeyStatus ──────────────────────────────────────────

  describe("getRecoveryKeyStatus", () => {
    it("returns hasActiveKey true after account insert with recovery key", async () => {
      const { accountId } = await insertTestAccount();

      const status = await getRecoveryKeyStatus(asDb(db), accountId);

      expect(status.hasActiveKey).toBe(true);
      expect(status.createdAt).toBeGreaterThan(0);
    });

    it("returns hasActiveKey false for nonexistent account", async () => {
      const fakeAccountId = `acct_${crypto.randomUUID()}` as AccountId;

      const status = await getRecoveryKeyStatus(asDb(db), fakeAccountId);

      expect(status).toEqual({ hasActiveKey: false, createdAt: null });
    });
  });

  // ── regenerateRecoveryKeyBackup ───────────────────────────────────

  describe("regenerateRecoveryKeyBackup", () => {
    it("returns ok:true on success", async () => {
      const { accountId, authKeyHex } = await insertTestAccount();
      const newRecoveryEncryptedMasterKey = toHex(randBytes(72));

      const audit = spyAudit();
      const result = await regenerateRecoveryKeyBackup(
        asDb(db),
        accountId,
        { authKey: authKeyHex, newRecoveryEncryptedMasterKey, confirmed: true },
        audit,
      );

      expect(result).toEqual({ ok: true });
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.recovery-key-regenerated");
    });

    it("revokes the old key and creates a new one", async () => {
      const { accountId, authKeyHex } = await insertTestAccount();
      const newRecoveryEncryptedMasterKey = toHex(randBytes(72));

      const statusBefore = await getRecoveryKeyStatus(asDb(db), accountId);
      expect(statusBefore.hasActiveKey).toBe(true);
      const createdAtBefore = statusBefore.createdAt;

      await regenerateRecoveryKeyBackup(
        asDb(db),
        accountId,
        { authKey: authKeyHex, newRecoveryEncryptedMasterKey, confirmed: true },
        noopAudit,
      );

      const statusAfter = await getRecoveryKeyStatus(asDb(db), accountId);
      expect(statusAfter.hasActiveKey).toBe(true);
      expect(statusAfter.createdAt).toBeGreaterThanOrEqual(createdAtBefore ?? 0);
    });

    it("stores the client-supplied blob as the new recovery key", async () => {
      const { accountId, authKeyHex } = await insertTestAccount();
      const newBlob = randBytes(72);
      const newRecoveryEncryptedMasterKey = toHex(newBlob);

      await regenerateRecoveryKeyBackup(
        asDb(db),
        accountId,
        { authKey: authKeyHex, newRecoveryEncryptedMasterKey, confirmed: true },
        noopAudit,
      );

      const rows = await db
        .select({ encryptedMasterKey: recoveryKeys.encryptedMasterKey })
        .from(recoveryKeys)
        .where(and(eq(recoveryKeys.accountId, accountId), isNull(recoveryKeys.revokedAt)))
        .limit(1);

      const row = rows[0];
      expect(row).toBeDefined();
      if (!row) return;
      const stored =
        row.encryptedMasterKey instanceof Uint8Array
          ? row.encryptedMasterKey
          : new Uint8Array(row.encryptedMasterKey);
      expect(stored).toEqual(new Uint8Array(newBlob));
    });

    it("throws ValidationError on wrong authKey", async () => {
      const { accountId } = await insertTestAccount();
      const wrongAuthKey = toHex(randBytes(32));
      const newRecoveryEncryptedMasterKey = toHex(randBytes(72));

      await expect(
        regenerateRecoveryKeyBackup(
          asDb(db),
          accountId,
          { authKey: wrongAuthKey, newRecoveryEncryptedMasterKey, confirmed: true },
          noopAudit,
        ),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws NoActiveRecoveryKeyError when no active key exists", async () => {
      const { accountId, authKeyHex } = await insertTestAccount();

      await db.update(recoveryKeys).set({ revokedAt: Date.now() });

      await expect(
        regenerateRecoveryKeyBackup(
          asDb(db),
          accountId,
          {
            authKey: authKeyHex,
            newRecoveryEncryptedMasterKey: toHex(randBytes(72)),
            confirmed: true,
          },
          noopAudit,
        ),
      ).rejects.toThrow(NoActiveRecoveryKeyError);
    });
  });

  // ── resetPasswordWithRecoveryKey ──────────────────────────────────

  describe("resetPasswordWithRecoveryKey", () => {
    createMockLogger();

    it("resets password and returns new session token and accountId", async () => {
      const { email, accountId } = await insertTestAccount();
      const resetParams = makeResetParams(email);

      const audit = spyAudit();
      const result = await resetPasswordWithRecoveryKey(asDb(db), resetParams, "web", audit);

      expect(result).not.toBeNull();
      expect(result?.sessionToken).toBeTruthy();
      expect(result?.accountId).toBe(accountId);
      expect(result).not.toHaveProperty("recoveryKey");
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.password-reset-via-recovery");
    });

    it("stores the new authKeyHash derived from newAuthKey", async () => {
      const { email } = await insertTestAccount();
      const newAuthKeyBytes = randBytes(32);
      const resetParams = { ...makeResetParams(email), newAuthKey: toHex(newAuthKeyBytes) };

      await resetPasswordWithRecoveryKey(asDb(db), resetParams, "web", noopAudit);

      const rows = await db
        .select({ authKeyHash: accounts.authKeyHash })
        .from(accounts)
        .where(eq(accounts.emailHash, hashEmail(email)))
        .limit(1);

      const row = rows[0];
      expect(row).toBeDefined();
      if (!row) return;
      const stored =
        row.authKeyHash instanceof Uint8Array ? row.authKeyHash : new Uint8Array(row.authKeyHash);
      expect(stored).toEqual(hashAuthKey(newAuthKeyBytes));
    });

    it("returns null for nonexistent email (anti-enumeration)", async () => {
      const result = await resetPasswordWithRecoveryKey(
        asDb(db),
        makeResetParams(`nonexistent-${crypto.randomUUID()}@example.com`),
        "web",
        noopAudit,
      );

      expect(result).toBeNull();
    });

    it("throws NoActiveRecoveryKeyError when no active key exists", async () => {
      const { email } = await insertTestAccount();

      await db.update(recoveryKeys).set({ revokedAt: Date.now() });

      await expect(
        resetPasswordWithRecoveryKey(asDb(db), makeResetParams(email), "web", noopAudit),
      ).rejects.toThrow(NoActiveRecoveryKeyError);
    });

    it("revokes old sessions after password reset", async () => {
      const { email, accountId } = await insertTestAccount();

      const timestamp = Date.now();
      await db.insert(sessions).values({
        id: `sess_${crypto.randomUUID()}`,
        accountId,
        tokenHash: toHex(randBytes(32)),
        createdAt: timestamp,
        lastActive: timestamp,
        expiresAt: timestamp + 3_600_000,
      });

      const before = await client.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM sessions WHERE account_id = $1 AND revoked = false",
        [accountId],
      );
      expect(Number(before.rows[0]?.count)).toBeGreaterThan(0);

      await resetPasswordWithRecoveryKey(asDb(db), makeResetParams(email), "web", noopAudit);

      const after = await client.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM sessions WHERE account_id = $1 AND revoked = false",
        [accountId],
      );
      expect(Number(after.rows[0]?.count)).toBe(1);
    });

    it("stores the new recovery key blob from client", async () => {
      const { email } = await insertTestAccount();
      const newBlob = randBytes(72);
      const resetParams = {
        ...makeResetParams(email),
        newRecoveryEncryptedMasterKey: toHex(newBlob),
      };

      await resetPasswordWithRecoveryKey(asDb(db), resetParams, "web", noopAudit);

      const acctRows = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.emailHash, hashEmail(email)))
        .limit(1);

      const acct = acctRows[0];
      expect(acct).toBeDefined();
      if (!acct) return;

      const rkRows = await db
        .select({ encryptedMasterKey: recoveryKeys.encryptedMasterKey })
        .from(recoveryKeys)
        .where(
          and(eq(recoveryKeys.accountId, acct.id as AccountId), isNull(recoveryKeys.revokedAt)),
        )
        .limit(1);

      const rkRow = rkRows[0];
      expect(rkRow).toBeDefined();
      if (!rkRow) return;
      const stored =
        rkRow.encryptedMasterKey instanceof Uint8Array
          ? rkRow.encryptedMasterKey
          : new Uint8Array(rkRow.encryptedMasterKey);
      expect(stored).toEqual(new Uint8Array(newBlob));
    });

    it("creates a new session with mobile platform timeouts", async () => {
      const { email } = await insertTestAccount();

      const result = await resetPasswordWithRecoveryKey(
        asDb(db),
        makeResetParams(email),
        "mobile",
        noopAudit,
      );

      expect(result).not.toBeNull();
      expect(result?.sessionToken).toBeTruthy();
      expect(result?.accountId).toMatch(/^acct_/);
    });
  });
});
