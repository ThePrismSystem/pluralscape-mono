import { PGlite } from "@electric-sql/pglite";
import { fromHex, hashAuthKey, initSodium, signChallenge, toHex } from "@pluralscape/crypto";
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
import { ValidationError } from "../../services/auth.service.js";
import { asDb, noopAudit, registerTestAccount, spyAudit } from "../helpers/integration-setup.js";

import type { AccountId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { accounts, authKeys, recoveryKeys, sessions, systems } = schema;

/** Dummy encrypted blob hex (48 bytes) — content irrelevant for account service tests. */
const DUMMY_BLOB = "aa".repeat(48);
/** Dummy KDF salt hex (16 bytes = 32 hex chars). */
const DUMMY_KDF_SALT = "bb".repeat(16);
/** Sign the new auth key hash with the account's signing key (for changePassword). */
function signNewAuthKey(
  newAuthKeyHex: string,
  signingSecretKey: Parameters<typeof signChallenge>[1],
): string {
  const newAuthKeyHash = hashAuthKey(fromHex(newAuthKeyHex));
  const sig = signChallenge(newAuthKeyHash, signingSecretKey);
  return toHex(sig);
}

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

  // ── getAccountInfo ──────────────────────────────────────────────

  describe("getAccountInfo", () => {
    it("returns account info for a registered account", async () => {
      const reg = await registerTestAccount(asDb(db));

      const info = await getAccountInfo(asDb(db), reg.accountId as AccountId);

      expect(info).not.toBeNull();
      expect(info?.accountId).toBe(reg.accountId);
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
    it("succeeds with correct current auth key", async () => {
      const reg = await registerTestAccount(asDb(db));

      const audit = spyAudit();
      const newAuthKey = "dd".repeat(32);
      const challengeSignature = signNewAuthKey(newAuthKey, reg.signingSecretKey);

      const result = await changePassword(
        asDb(db),
        reg.accountId as AccountId,
        {
          oldAuthKey: reg.authKeyHex,
          newAuthKey,
          newKdfSalt: DUMMY_KDF_SALT,
          newEncryptedMasterKey: DUMMY_BLOB,
          challengeSignature,
        },
        audit,
      );

      expect(result.ok).toBe(true);
      expect(typeof result.revokedSessionCount).toBe("number");
      expect(result.sessionRevoked).toBe(true);
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.password-changed");
    });

    it("throws ValidationError with wrong current auth key", async () => {
      const reg = await registerTestAccount(asDb(db));
      const newAuthKey = "ee".repeat(32);
      const challengeSignature = signNewAuthKey(newAuthKey, reg.signingSecretKey);

      await expect(
        changePassword(
          asDb(db),
          reg.accountId as AccountId,
          {
            oldAuthKey: "ff".repeat(32),
            newAuthKey,
            newKdfSalt: DUMMY_KDF_SALT,
            newEncryptedMasterKey: DUMMY_BLOB,
            challengeSignature,
          },
          noopAudit,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── changeEmail ──────────────────────────────────────────────────

  describe("changeEmail", () => {
    it("succeeds with correct auth key and new email", async () => {
      const reg = await registerTestAccount(asDb(db));

      const audit = spyAudit();
      const newEmail = `changed-${crypto.randomUUID()}@example.com`;

      const result = await changeEmail(
        asDb(db),
        reg.accountId as AccountId,
        { email: newEmail, authKey: reg.authKeyHex },
        audit,
      );

      expect(result).toEqual({ ok: true });
      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.email-changed");
    });

    it("throws ValidationError with wrong auth key", async () => {
      const reg = await registerTestAccount(asDb(db));

      await expect(
        changeEmail(
          asDb(db),
          reg.accountId as AccountId,
          { email: `new-${crypto.randomUUID()}@example.com`, authKey: "ff".repeat(32) },
          noopAudit,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ── updateAccountSettings ──────────────────────────────────────

  describe("updateAccountSettings", () => {
    it("enables audit log IP tracking", async () => {
      const reg = await registerTestAccount(asDb(db));

      const audit = spyAudit();
      const result = await updateAccountSettings(
        asDb(db),
        reg.accountId as AccountId,
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
      const reg = await registerTestAccount(asDb(db));

      await expect(
        updateAccountSettings(
          asDb(db),
          reg.accountId as AccountId,
          { auditLogIpTracking: true, version: 99 },
          noopAudit,
        ),
      ).rejects.toThrow(ConcurrencyError);
    });

    it("roundtrips enable then disable", async () => {
      const reg = await registerTestAccount(asDb(db));

      const r1 = await updateAccountSettings(
        asDb(db),
        reg.accountId as AccountId,
        { auditLogIpTracking: true, version: 1 },
        noopAudit,
      );
      expect(r1.auditLogIpTracking).toBe(true);
      expect(r1.version).toBe(2);

      const r2 = await updateAccountSettings(
        asDb(db),
        reg.accountId as AccountId,
        { auditLogIpTracking: false, version: 2 },
        noopAudit,
      );
      expect(r2.auditLogIpTracking).toBe(false);
      expect(r2.version).toBe(3);

      const info = await getAccountInfo(asDb(db), reg.accountId as AccountId);
      expect(info?.auditLogIpTracking).toBe(false);
      expect(info?.version).toBe(3);
    });
  });
});
