import { PGlite } from "@electric-sql/pglite";
import { initSodium } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import { createPgAuthTables, PG_DDL, pgExec } from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/** 64-hex-char (32-byte) test pepper for email hashing. */
const TEST_PEPPER = vi.hoisted(() => "ab".repeat(32));

vi.mock("../../env.js", () => ({
  env: {
    EMAIL_HASH_PEPPER: TEST_PEPPER,
  },
}));

import {
  changeEmail,
  changePassword,
  ConcurrencyError,
  getAccountInfo,
  updateAccountSettings,
} from "../../services/account.service.js";
import { registerAccount, ValidationError } from "../../services/auth.service.js";
import { asDb, noopAudit, spyAudit } from "../helpers/integration-setup.js";

import type { AccountId, SessionId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { accounts, authKeys, recoveryKeys, sessions, systems } = schema;

describe("account.service (PGlite integration)", { timeout: 60_000 }, () => {
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

  /** Register a fresh account and return its ID plus the password used. */
  async function registerTestAccount(
    overrides: { email?: string; password?: string } = {},
  ): Promise<{ accountId: AccountId; password: string; sessionToken: string }> {
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
      sessionToken: result.sessionToken,
    };
  }

  // ── getAccountInfo ──────────────────────────────────────────────

  describe("getAccountInfo", () => {
    it("returns account info for a registered account", async () => {
      const { accountId } = await registerTestAccount();

      const info = await getAccountInfo(asDb(db), accountId);

      expect(info).not.toBeNull();
      expect(info?.accountId).toBe(accountId);
      expect(info?.accountType).toBe("system");
      expect(info?.systemId).toMatch(/^sys_/);
      expect(typeof info?.createdAt).toBe("number");
      expect(typeof info?.updatedAt).toBe("number");
      expect(info?.createdAt).toBeGreaterThan(0);
      expect(info?.updatedAt).toBeGreaterThanOrEqual(info?.createdAt ?? 0);
      expect(info?.auditLogIpTracking).toBe(false);
      expect(info?.version).toBe(1);
    });

    it("returns null for a nonexistent account", async () => {
      const info = await getAccountInfo(asDb(db), `acct_${crypto.randomUUID()}` as AccountId);
      expect(info).toBeNull();
    });
  });

  // ── changePassword ──────────────────────────────────────────────

  describe("changePassword", () => {
    it("succeeds with correct current password", async () => {
      const { accountId, password } = await registerTestAccount();

      const sessionRows = await client.query<{ id: string }>(
        "SELECT id FROM sessions WHERE account_id = $1 LIMIT 1",
        [accountId],
      );
      const sessionId = sessionRows.rows[0]?.id as SessionId;

      const audit = spyAudit();
      const newPassword = `NewP@ss!${crypto.randomUUID()}`;

      const result = await changePassword(
        asDb(db),
        accountId,
        sessionId,
        { currentPassword: password, newPassword },
        audit,
      );

      expect(result.ok).toBe(true);
      expect(typeof result.revokedSessionCount).toBe("number");
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.password-changed");
    });

    it("throws ValidationError with wrong current password", async () => {
      const { accountId } = await registerTestAccount();

      const sessionRows = await client.query<{ id: string }>(
        "SELECT id FROM sessions WHERE account_id = $1 LIMIT 1",
        [accountId],
      );
      const sessionId = sessionRows.rows[0]?.id as SessionId;

      await expect(
        changePassword(
          asDb(db),
          accountId,
          sessionId,
          { currentPassword: "WrongPassword123!", newPassword: "AnotherP@ss1" },
          noopAudit,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── changeEmail ──────────────────────────────────────────────────

  describe("changeEmail", () => {
    it("succeeds with correct password and new email", async () => {
      const { accountId, password } = await registerTestAccount();

      const audit = spyAudit();
      const newEmail = `changed-${crypto.randomUUID()}@example.com`;

      const result = await changeEmail(
        asDb(db),
        accountId,
        { email: newEmail, currentPassword: password },
        audit,
      );

      expect(result).toEqual({ ok: true });
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.email-changed");
    });

    it("throws ValidationError with wrong password", async () => {
      const { accountId } = await registerTestAccount();

      await expect(
        changeEmail(
          asDb(db),
          accountId,
          { email: `new-${crypto.randomUUID()}@example.com`, currentPassword: "WrongPassword!" },
          noopAudit,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── updateAccountSettings ──────────────────────────────────────

  describe("updateAccountSettings", () => {
    it("enables audit log IP tracking", async () => {
      const { accountId } = await registerTestAccount();

      const audit = spyAudit();
      const result = await updateAccountSettings(
        asDb(db),
        accountId,
        { auditLogIpTracking: true, version: 1 },
        audit,
      );

      expect(result).toEqual({ ok: true, auditLogIpTracking: true, version: 2 });
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("settings.changed");
      expect(audit.calls[0]?.detail).toBe("Audit log IP tracking enabled");
      expect(audit.calls[0]?.overrideTrackIp).toBe(true);
    });

    it("throws ConcurrencyError on version mismatch", async () => {
      const { accountId } = await registerTestAccount();

      await expect(
        updateAccountSettings(
          asDb(db),
          accountId,
          { auditLogIpTracking: true, version: 99 },
          noopAudit,
        ),
      ).rejects.toThrow(ConcurrencyError);
    });

    it("roundtrips enable then disable", async () => {
      const { accountId } = await registerTestAccount();

      const r1 = await updateAccountSettings(
        asDb(db),
        accountId,
        { auditLogIpTracking: true, version: 1 },
        noopAudit,
      );
      expect(r1.auditLogIpTracking).toBe(true);
      expect(r1.version).toBe(2);

      const r2 = await updateAccountSettings(
        asDb(db),
        accountId,
        { auditLogIpTracking: false, version: 2 },
        noopAudit,
      );
      expect(r2.auditLogIpTracking).toBe(false);
      expect(r2.version).toBe(3);

      const info = await getAccountInfo(asDb(db), accountId);
      expect(info?.auditLogIpTracking).toBe(false);
      expect(info?.version).toBe(3);
    });
  });
});
