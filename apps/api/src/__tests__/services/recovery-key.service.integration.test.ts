import { PGlite } from "@electric-sql/pglite";
import { initSodium } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import { createPgAuthTables, PG_DDL, pgExec } from "@pluralscape/db/test-helpers/pg-helpers";
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

import { registerAccount } from "../../services/auth.service.js";
import {
  getRecoveryKeyStatus,
  NoActiveRecoveryKeyError,
  regenerateRecoveryKeyBackup,
  resetPasswordWithRecoveryKey,
} from "../../services/recovery-key.service.js";
import { noopAudit, spyAudit, asDb } from "../helpers/integration-setup.js";
import { createMockLogger } from "../helpers/mock-logger.js";

import type { AccountId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { accounts, authKeys, recoveryKeys, sessions, systems } = schema;

describe("recovery-key.service (PGlite integration)", { timeout: 60_000 }, () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    await initSodium();
    client = await PGlite.create();
    db = drizzle(client, { schema });

    // Auth tables (accounts, auth_keys, sessions, recovery_keys, device_transfer_requests)
    await createPgAuthTables(client);
    // Systems table (needed for accountType=system registration)
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

  /** Register a fresh account and return IDs, password, and recovery key. */
  async function registerTestAccount(
    overrides: { email?: string; password?: string } = {},
  ): Promise<{
    accountId: AccountId;
    password: string;
    email: string;
    recoveryKey: string;
    sessionToken: string;
  }> {
    const email = overrides.email ?? `test-${crypto.randomUUID()}@example.com`;
    const password = overrides.password ?? `P@ssw0rd!${crypto.randomUUID()}`;
    const result = await registerAccount(
      asDb(db),
      {
        email,
        password,
        recoveryKeyBackupConfirmed: true,
        accountType: "system",
      },
      "web",
      noopAudit,
    );
    return {
      accountId: result.accountId as AccountId,
      password,
      email,
      recoveryKey: result.recoveryKey,
      sessionToken: result.sessionToken,
    };
  }

  // ── getRecoveryKeyStatus ──────────────────────────────────────────

  describe("getRecoveryKeyStatus", () => {
    it("returns hasActiveKey true after registration", async () => {
      const { accountId } = await registerTestAccount();

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
    it("returns a new recovery key on success", async () => {
      const { accountId, password } = await registerTestAccount();

      const audit = spyAudit();
      const result = await regenerateRecoveryKeyBackup(
        asDb(db),
        accountId,
        { currentPassword: password, confirmed: true },
        audit,
      );

      expect(result.recoveryKey).toBeTruthy();
      expect(typeof result.recoveryKey).toBe("string");
      // Recovery keys are dash-separated groups of uppercase alphanumeric characters
      expect(result.recoveryKey).toMatch(/^[A-Z2-7]+(-[A-Z2-7]+)+$/);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.recovery-key-regenerated");
    });

    it("revokes the old key and creates a new one", async () => {
      const { accountId, password } = await registerTestAccount();

      const statusBefore = await getRecoveryKeyStatus(asDb(db), accountId);
      expect(statusBefore.hasActiveKey).toBe(true);
      const createdAtBefore = statusBefore.createdAt;

      await regenerateRecoveryKeyBackup(
        asDb(db),
        accountId,
        { currentPassword: password, confirmed: true },
        noopAudit,
      );

      const statusAfter = await getRecoveryKeyStatus(asDb(db), accountId);
      expect(statusAfter.hasActiveKey).toBe(true);
      // New key should have a different (later or equal) createdAt
      expect(statusAfter.createdAt).toBeGreaterThanOrEqual(createdAtBefore ?? 0);
    });

    it("throws ValidationError on wrong password", async () => {
      const { accountId } = await registerTestAccount();

      await expect(
        regenerateRecoveryKeyBackup(
          asDb(db),
          accountId,
          { currentPassword: "WrongPassword123!", confirmed: true },
          noopAudit,
        ),
      ).rejects.toThrow("Incorrect password");
    });

    it("throws NoActiveRecoveryKeyError when no active key exists", async () => {
      const { accountId, password } = await registerTestAccount();

      // Revoke all recovery keys manually
      await db.update(recoveryKeys).set({ revokedAt: Date.now() });

      await expect(
        regenerateRecoveryKeyBackup(
          asDb(db),
          accountId,
          { currentPassword: password, confirmed: true },
          noopAudit,
        ),
      ).rejects.toThrow(NoActiveRecoveryKeyError);
    });
  });

  // ── resetPasswordWithRecoveryKey ──────────────────────────────────

  describe("resetPasswordWithRecoveryKey", () => {
    const { logger: mockLogger } = createMockLogger();

    it("resets password and returns new session token and recovery key", async () => {
      const { email, recoveryKey } = await registerTestAccount();
      const newPassword = `NewP@ss!${crypto.randomUUID()}`;

      const audit = spyAudit();
      const result = await resetPasswordWithRecoveryKey(
        asDb(db),
        { email, recoveryKey, newPassword },
        "web",
        audit,
        mockLogger,
      );

      expect(result).not.toBeNull();
      expect(result?.sessionToken).toBeTruthy();
      expect(result?.recoveryKey).toBeTruthy();
      expect(result?.recoveryKey).toMatch(/^[A-Z2-7]+(-[A-Z2-7]+)+$/);
      expect(result?.accountId).toMatch(/^acct_/);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.password-reset-via-recovery");
    });

    it("returns null for nonexistent email (anti-enumeration)", async () => {
      const result = await resetPasswordWithRecoveryKey(
        asDb(db),
        {
          email: `nonexistent-${crypto.randomUUID()}@example.com`,
          recoveryKey: "ABCD-EFGH-IJKL-MNOP",
          newPassword: "SomeP@ssword123!",
        },
        "web",
        noopAudit,
        mockLogger,
      );

      expect(result).toBeNull();
    });

    it("throws NoActiveRecoveryKeyError when no active key exists", async () => {
      const { email } = await registerTestAccount();

      // Revoke all recovery keys manually
      await db.update(recoveryKeys).set({ revokedAt: Date.now() });

      await expect(
        resetPasswordWithRecoveryKey(
          asDb(db),
          {
            email,
            recoveryKey: "ABCD-EFGH-IJKL-MNOP",
            newPassword: "SomeP@ssword123!",
          },
          "web",
          noopAudit,
          mockLogger,
        ),
      ).rejects.toThrow(NoActiveRecoveryKeyError);
    });

    it("revokes old sessions after password reset", async () => {
      const { email, recoveryKey, accountId } = await registerTestAccount();
      const newPassword = `NewP@ss!${crypto.randomUUID()}`;

      // Count sessions before reset
      const sessionsBefore = await client.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM sessions WHERE account_id = $1 AND revoked = false",
        [accountId],
      );
      expect(Number(sessionsBefore.rows[0]?.count)).toBeGreaterThan(0);

      await resetPasswordWithRecoveryKey(
        asDb(db),
        { email, recoveryKey, newPassword },
        "web",
        noopAudit,
        mockLogger,
      );

      // Old sessions should be revoked; only the new one should remain active
      const sessionsAfter = await client.query<{ count: string }>(
        "SELECT COUNT(*) as count FROM sessions WHERE account_id = $1 AND revoked = false",
        [accountId],
      );
      expect(Number(sessionsAfter.rows[0]?.count)).toBe(1);
    });
  });
});
