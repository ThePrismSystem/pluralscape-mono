import { PGlite } from "@electric-sql/pglite";
import { encryptTier1, generateMasterKey, getSodium, initSodium, toHex } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import { createPgAuthTables, PG_DDL, pgExec } from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Ensure EMAIL_HASH_PEPPER is available before env.ts is evaluated.
// The env module reads process.env at import time; in CI or local dev the
// variable may not be set, which causes hashEmail to throw.
vi.hoisted(() => {
  process.env["EMAIL_HASH_PEPPER"] ??= "ab".repeat(32);
});

import {
  ACCOUNT_LOGIN_MAX_ATTEMPTS,
  MemoryAccountLoginStore,
  _resetAccountLoginStoreForTesting,
  setAccountLoginStore,
} from "../../middleware/stores/account-login-store.js";
import { LoginThrottledError, loginAccount } from "../../services/auth/login.js";
import { isDuplicateEmailError } from "../../services/auth/register.js";
import {
  listSessions,
  logoutCurrentSession,
  revokeAllSessions,
  revokeSession,
} from "../../services/auth/sessions.js";
import { asDb, noopAudit, registerTestAccount, spyAudit } from "../helpers/integration-setup.js";
import { createMockLogger } from "../helpers/mock-logger.js";

import type { RegistrationCommitResult } from "../../services/auth/register.js";
import type { AccountId, SessionId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { accounts, authKeys, recoveryKeys, sessions, systems } = schema;

describe("auth.service (PGlite integration)", { timeout: 60_000 }, () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  const { logger } = createMockLogger();

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
    _resetAccountLoginStoreForTesting();
  });

  // ── registerTestAccount (integration helper) ───────────────────────

  describe("registerTestAccount (two-phase flow)", () => {
    it("succeeds and returns sessionToken, accountId, and accountType", async () => {
      const result = await registerTestAccount(asDb(db));

      expect(typeof result.sessionToken).toBe("string");
      expect(result.sessionToken.length).toBeGreaterThan(0);
      expect(result.accountId).toMatch(/^acct_/);
      expect(result.accountType).toBe("system");
    });

    it("rejects duplicate email with a unique constraint violation", async () => {
      const email = `dup-${crypto.randomUUID()}@test.local`;

      await registerTestAccount(asDb(db), { email });

      let caught: unknown;
      try {
        await registerTestAccount(asDb(db), { email });
      } catch (err: unknown) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
      // Walk the cause chain to find the PG unique violation (code 23505)
      let current: unknown = caught;
      let foundViolation = false;
      for (let depth = 0; current instanceof Error && depth < 5; depth++) {
        if ("code" in current && current.code === "23505") {
          foundViolation = true;
          break;
        }
        current = current.cause;
      }
      expect(foundViolation).toBe(true);
    });

    it("registers a viewer account (no system row created)", async () => {
      const result = await registerTestAccount(asDb(db), { accountType: "viewer" });

      expect(result.accountType).toBe("viewer");
      expect(result.accountId).toMatch(/^acct_/);
    });

    it("uses mobile platform timeouts when platform is mobile", async () => {
      const result = await registerTestAccount(asDb(db), { platform: "mobile" });
      expect(result.sessionToken.length).toBeGreaterThan(0);
    });
  });

  // ── loginAccount ───────────────────────────────────────────────────

  describe("loginAccount", () => {
    let registeredEmail: string;
    let registration: RegistrationCommitResult & { authKeyHex: string; email: string };

    beforeEach(async () => {
      registeredEmail = `login-${crypto.randomUUID()}@test.local`;
      registration = await registerTestAccount(asDb(db), { email: registeredEmail });
    });

    it("returns session token with correct auth key", async () => {
      const result = await loginAccount(
        asDb(db),
        { email: registeredEmail, authKey: registration.authKeyHex },
        "web",
        noopAudit,
        logger,
      );

      expect(result).not.toBeNull();
      expect(result).toEqual(
        expect.objectContaining({
          accountId: registration.accountId,
          accountType: "system",
        }),
      );
      expect(typeof result?.sessionToken).toBe("string");
      expect(result?.sessionToken.length).toBeGreaterThan(0);
      expect(result?.systemId).toMatch(/^sys_/);
    });

    it("returns null for wrong auth key", async () => {
      const result = await loginAccount(
        asDb(db),
        { email: registeredEmail, authKey: "ff".repeat(32) },
        "web",
        noopAudit,
        logger,
      );

      expect(result).toBeNull();
    });

    it("returns null for non-existent account (anti-enumeration)", async () => {
      const result = await loginAccount(
        asDb(db),
        { email: `nonexistent-${crypto.randomUUID()}@test.local`, authKey: "aa".repeat(32) },
        "web",
        noopAudit,
        logger,
      );

      expect(result).toBeNull();
    });

    it("throws LoginThrottledError when account is throttled", async () => {
      const store = new MemoryAccountLoginStore();
      setAccountLoginStore(store);

      const throttledEmail = `throttle-${crypto.randomUUID()}@test.local`;

      for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
        const { hashEmail } = await import("../../lib/email-hash.js");
        const key = hashEmail(throttledEmail);
        await store.recordFailure(key);
      }

      let caught: unknown;
      try {
        await loginAccount(
          asDb(db),
          { email: throttledEmail, authKey: "aa".repeat(32) },
          "web",
          noopAudit,
          logger,
        );
      } catch (err: unknown) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(LoginThrottledError);
      const throttleErr = caught as LoginThrottledError;
      expect(throttleErr.windowResetAt).toBeGreaterThan(0);
    });

    it("returns null for viewer account with wrong auth key (accountType branch)", async () => {
      const viewerEmail = `viewer-${crypto.randomUUID()}@test.local`;
      await registerTestAccount(asDb(db), { email: viewerEmail, accountType: "viewer" });

      const result = await loginAccount(
        asDb(db),
        { email: viewerEmail, authKey: "ff".repeat(32) },
        "web",
        noopAudit,
        logger,
      );

      expect(result).toBeNull();
    });

    it("returns null systemId for viewer account on successful login", async () => {
      const viewerEmail = `viewer2-${crypto.randomUUID()}@test.local`;
      const viewerReg = await registerTestAccount(asDb(db), {
        email: viewerEmail,
        accountType: "viewer",
      });

      const result = await loginAccount(
        asDb(db),
        { email: viewerEmail, authKey: viewerReg.authKeyHex },
        "web",
        noopAudit,
        logger,
      );

      expect(result).not.toBeNull();
      expect(result?.accountType).toBe("viewer");
      expect(result?.systemId).toBeNull();
    });

    it("evicts oldest session when MAX_SESSIONS_PER_ACCOUNT is exceeded", async () => {
      const { MAX_SESSIONS_PER_ACCOUNT } = await import("../../quota.constants.js");

      const firstSessionIds: string[] = [];
      for (let i = 0; i < MAX_SESSIONS_PER_ACCOUNT; i++) {
        const res = await loginAccount(
          asDb(db),
          { email: registeredEmail, authKey: registration.authKeyHex },
          "web",
          noopAudit,
          logger,
        );
        expect(res).not.toBeNull();
        const { sessions: all } = await listSessions(
          asDb(db),
          brandId<AccountId>(registration.accountId),
        );
        firstSessionIds.push(all[all.length - 1]?.id ?? "");
      }

      await loginAccount(
        asDb(db),
        { email: registeredEmail, authKey: registration.authKeyHex },
        "web",
        noopAudit,
        logger,
      );

      const { sessions: after } = await listSessions(
        asDb(db),
        brandId<AccountId>(registration.accountId),
      );
      expect(after.length).toBeLessThanOrEqual(MAX_SESSIONS_PER_ACCOUNT);
    });
  });

  // ── listSessions ──────────────────────────────────────────────────

  describe("listSessions", () => {
    it("returns at least one session after registration", async () => {
      const reg = await registerTestAccount(asDb(db));

      const { sessions: sessionList } = await listSessions(
        asDb(db),
        brandId<AccountId>(reg.accountId),
      );

      expect(sessionList.length).toBeGreaterThanOrEqual(1);
      const first = sessionList[0];
      if (first) {
        expect(first.id).toMatch(/^sess_/);
        expect(typeof first.createdAt).toBe("number");
      }
    });

    it("respects cursor-based pagination", async () => {
      const reg = await registerTestAccount(asDb(db));

      // Create a second session by logging in
      await loginAccount(
        asDb(db),
        { email: reg.email, authKey: reg.authKeyHex },
        "web",
        noopAudit,
        createMockLogger().logger,
      );

      const all = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      expect(all.sessions.length).toBeGreaterThanOrEqual(2);

      const page1 = await listSessions(asDb(db), brandId<AccountId>(reg.accountId), undefined, 1);
      expect(page1.sessions).toHaveLength(1);
      expect(page1.nextCursor).not.toBeNull();

      const rawCursor = page1.sessions[0]?.id;
      expect(typeof rawCursor).toBe("string");

      const page2 = await listSessions(asDb(db), brandId<AccountId>(reg.accountId), rawCursor, 1);
      expect(page2.sessions).toHaveLength(1);
      expect(page2.sessions[0]?.id).not.toBe(rawCursor);
    });

    it("projects encryptedData=null for sessions without a DeviceInfo blob", async () => {
      const reg = await registerTestAccount(asDb(db));

      const { sessions: sessionList } = await listSessions(
        asDb(db),
        brandId<AccountId>(reg.accountId),
      );

      expect(sessionList.length).toBeGreaterThanOrEqual(1);
      expect(sessionList[0]?.encryptedData).toBeNull();
    });

    it("projects encryptedData as base64 string when row has a stored blob", async () => {
      const sodium = getSodium();
      const reg = await registerTestAccount(asDb(db));
      const masterKey = generateMasterKey();
      const blob = encryptTier1(
        { platform: "ios", appVersion: "1.0.0", deviceName: "Test iPhone" },
        masterKey,
      );

      await db.insert(sessions).values({
        id: brandId<SessionId>(`sess_${crypto.randomUUID()}`),
        accountId: brandId<AccountId>(reg.accountId),
        tokenHash: toHex(sodium.randomBytes(32)),
        encryptedData: blob,
        createdAt: toUnixMillis(Date.now()),
        lastActive: toUnixMillis(Date.now()),
        expiresAt: toUnixMillis(Date.now() + 3_600_000),
      });

      const { sessions: sessionList } = await listSessions(
        asDb(db),
        brandId<AccountId>(reg.accountId),
      );

      const withBlob = sessionList.find((s) => s.encryptedData !== null);
      expect(withBlob).toBeDefined();
      expect(typeof withBlob?.encryptedData).toBe("string");
      expect(withBlob?.encryptedData).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  // ── revokeSession ─────────────────────────────────────────────────

  describe("revokeSession", () => {
    it("revokes a session and removes it from the active list", async () => {
      const reg = await registerTestAccount(asDb(db));

      const { sessions: before } = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      expect(before.length).toBeGreaterThanOrEqual(1);
      const firstSession = before[0];
      if (!firstSession) return;

      const audit = spyAudit();
      const revoked = await revokeSession(
        asDb(db),
        firstSession.id,
        brandId<AccountId>(reg.accountId),
        audit,
      );
      expect(revoked).toBe(true);

      const { sessions: after } = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      const found = after.find((s) => s.id === firstSession.id);
      expect(found).toBeUndefined();

      expect(audit.calls).toHaveLength(1);
      const auditCall = audit.calls[0];
      if (auditCall) {
        expect(auditCall.eventType).toBe("auth.logout");
      }
    });

    it("returns false when revoking an already-revoked session", async () => {
      const reg = await registerTestAccount(asDb(db));

      const { sessions: before } = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      const firstSession = before[0];
      if (!firstSession) return;

      await revokeSession(asDb(db), firstSession.id, brandId<AccountId>(reg.accountId), noopAudit);

      const result = await revokeSession(
        asDb(db),
        firstSession.id,
        brandId<AccountId>(reg.accountId),
        noopAudit,
      );
      expect(result).toBe(false);
    });

    it("returns false for a session that belongs to a different account", async () => {
      const reg = await registerTestAccount(asDb(db));
      const other = await registerTestAccount(asDb(db));

      const { sessions: otherSessions } = await listSessions(
        asDb(db),
        brandId<AccountId>(other.accountId),
      );
      const otherSession = otherSessions[0];
      if (!otherSession) return;

      const result = await revokeSession(
        asDb(db),
        otherSession.id,
        brandId<AccountId>(reg.accountId),
        noopAudit,
      );
      expect(result).toBe(false);
    });
  });

  // ── revokeAllSessions ─────────────────────────────────────────────

  describe("revokeAllSessions", () => {
    it("revokes all sessions except the specified one", async () => {
      const reg = await registerTestAccount(asDb(db));

      await loginAccount(
        asDb(db),
        { email: reg.email, authKey: reg.authKeyHex },
        "web",
        noopAudit,
        logger,
      );

      const { sessions: before } = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      expect(before.length).toBeGreaterThanOrEqual(2);
      const keepSession = before[0];
      if (!keepSession) return;

      const audit = spyAudit();
      const count = await revokeAllSessions(
        asDb(db),
        brandId<AccountId>(reg.accountId),
        keepSession.id,
        audit,
      );

      expect(count).toBeGreaterThanOrEqual(1);

      const { sessions: after } = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      expect(after).toHaveLength(1);
      expect(after[0]?.id).toBe(keepSession.id);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.logout");
    });

    it("returns 0 when no other sessions exist", async () => {
      const reg = await registerTestAccount(asDb(db));

      const { sessions: all } = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      const only = all[0];
      if (!only) return;

      const count = await revokeAllSessions(
        asDb(db),
        brandId<AccountId>(reg.accountId),
        only.id,
        noopAudit,
      );
      expect(count).toBe(0);
    });
  });

  // ── logoutCurrentSession ──────────────────────────────────────────

  describe("logoutCurrentSession", () => {
    it("revokes the current session so it no longer appears in listSessions", async () => {
      const reg = await registerTestAccount(asDb(db));

      const { sessions: before } = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      const current = before[0];
      if (!current) return;

      const audit = spyAudit();
      await logoutCurrentSession(asDb(db), current.id, brandId<AccountId>(reg.accountId), audit);

      const { sessions: after } = await listSessions(asDb(db), brandId<AccountId>(reg.accountId));
      expect(after.find((s) => s.id === current.id)).toBeUndefined();

      expect(audit.calls[0]?.eventType).toBe("auth.logout");
    });
  });

  // ── isDuplicateEmailError ─────────────────────────────────────────

  describe("isDuplicateEmailError", () => {
    it("returns false for non-Error values", () => {
      expect(isDuplicateEmailError(null)).toBe(false);
      expect(isDuplicateEmailError("string error")).toBe(false);
      expect(isDuplicateEmailError(42)).toBe(false);
    });

    it("returns false when the constraint name does not match", () => {
      const err = Object.assign(new Error("unique violation"), {
        code: "23505",
        constraint_name: "some_other_constraint",
      });
      expect(isDuplicateEmailError(err)).toBe(false);
    });

    it("returns true when constraint_name matches on the error directly", () => {
      const err = Object.assign(new Error("unique violation"), {
        code: "23505",
        constraint_name: "accounts_email_hash_idx",
      });
      expect(isDuplicateEmailError(err)).toBe(true);
    });

    it("returns true when constraint_name is on error.cause (DrizzleQueryError wrapper)", () => {
      const cause = Object.assign(new Error("cause"), {
        code: "23505",
        constraint_name: "accounts_email_hash_idx",
      });
      const wrapper = Object.assign(new Error("wrapper"), { code: "23505", cause });
      expect(isDuplicateEmailError(wrapper)).toBe(true);
    });
  });
});
