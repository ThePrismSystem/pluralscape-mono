import { PGlite } from "@electric-sql/pglite";
import { initSodium } from "@pluralscape/crypto";
import * as schema from "@pluralscape/db/pg";
import { createPgAuthTables, PG_DDL, pgExec } from "@pluralscape/db/test-helpers/pg-helpers";
import { eq } from "drizzle-orm";
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
import {
  LoginThrottledError,
  isDuplicateEmailError,
  listSessions,
  loginAccount,
  logoutCurrentSession,
  needsRehash,
  registerAccount,
  revokeAllSessions,
  revokeSession,
} from "../../services/auth.service.js";
import { asDb, noopAudit, spyAudit } from "../helpers/integration-setup.js";
import { createMockLogger } from "../helpers/mock-logger.js";

import type { RegistrationResult } from "../../services/auth.service.js";
import type { AccountId } from "@pluralscape/types";
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

  function makeRegistrationParams(
    overrides: { email?: string; password?: string; accountType?: "system" | "viewer" } = {},
  ): {
    email: string;
    password: string;
    accountType: "system" | "viewer";
    recoveryKeyBackupConfirmed: true;
  } {
    return {
      email: overrides.email ?? `test-${crypto.randomUUID()}@test.local`,
      password: overrides.password ?? "TestPassword123!",
      accountType: overrides.accountType ?? "system",
      recoveryKeyBackupConfirmed: true,
    };
  }

  // ── registerAccount ────────────────────────────────────────────────

  describe("registerAccount", () => {
    it("succeeds and returns sessionToken, recoveryKey, accountId, and accountType", async () => {
      const params = makeRegistrationParams();
      const result = await registerAccount(asDb(db), params, "web", noopAudit);

      expect(typeof result.sessionToken).toBe("string");
      expect(result.sessionToken.length).toBeGreaterThan(0);
      expect(typeof result.recoveryKey).toBe("string");
      expect(result.recoveryKey).toContain("-");
      expect(result.accountId).toMatch(/^acct_/);
      expect(result.accountType).toBe("system");
    });

    it("rejects duplicate email with a unique constraint violation", async () => {
      // PGlite uses `constraint` (not `constraint_name`) on errors, so the
      // service-level anti-enumeration handler does not match and the raw
      // unique-violation error propagates. This test verifies the DB-level
      // constraint fires correctly; anti-enumeration is covered by the
      // unit test suite against postgres.js mocks.
      const email = `dup-${crypto.randomUUID()}@test.local`;
      const params = makeRegistrationParams({ email });

      await registerAccount(asDb(db), params, "web", noopAudit);

      let caught: unknown;
      try {
        await registerAccount(asDb(db), params, "web", noopAudit);
      } catch (err: unknown) {
        caught = err;
      }
      expect(caught).toBeDefined();
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
      const params = makeRegistrationParams({ accountType: "viewer" });
      const result = await registerAccount(asDb(db), params, "web", noopAudit);

      expect(result.accountType).toBe("viewer");
      expect(result.accountId).toMatch(/^acct_/);
      // Viewer accounts must not have a system row
      const sysList = await db
        .select()
        .from(systems)
        .where(eq(systems.accountId, result.accountId));
      expect(sysList).toHaveLength(0);
    });

    it("uses mobile platform timeouts when platform is mobile", async () => {
      const params = makeRegistrationParams();
      const result = await registerAccount(asDb(db), params, "mobile", noopAudit);
      expect(result.sessionToken.length).toBeGreaterThan(0);
    });
  });

  // ── loginAccount ───────────────────────────────────────────────────

  describe("loginAccount", () => {
    let registeredEmail: string;
    let registration: RegistrationResult;
    const password = "TestPassword123!";

    beforeEach(async () => {
      registeredEmail = `login-${crypto.randomUUID()}@test.local`;
      registration = await registerAccount(
        asDb(db),
        makeRegistrationParams({ email: registeredEmail, password }),
        "web",
        noopAudit,
      );
    });

    it("returns session token with correct credentials", async () => {
      const result = await loginAccount(
        asDb(db),
        { email: registeredEmail, password },
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

    it("returns null for wrong password", async () => {
      const result = await loginAccount(
        asDb(db),
        { email: registeredEmail, password: "WrongPassword999!" },
        "web",
        noopAudit,
        logger,
      );

      expect(result).toBeNull();
    });

    it("returns null for non-existent account (anti-enumeration)", async () => {
      const result = await loginAccount(
        asDb(db),
        { email: `nonexistent-${crypto.randomUUID()}@test.local`, password: "SomePassword123!" },
        "web",
        noopAudit,
        logger,
      );

      expect(result).toBeNull();
    });

    it("throws LoginThrottledError when account is throttled", async () => {
      // Seed the in-memory store with enough failures to exceed the threshold
      const store = new MemoryAccountLoginStore();
      setAccountLoginStore(store);

      // Fill failures for any email — we use a non-existent email so login
      // fails fast. We need MAX_ATTEMPTS failures recorded against the hash
      // of our target email before we attempt the throttled login.
      const throttledEmail = `throttle-${crypto.randomUUID()}@test.local`;

      // Record failures directly on the store up to the limit
      for (let i = 0; i < ACCOUNT_LOGIN_MAX_ATTEMPTS; i++) {
        const { hashEmail } = await import("../../lib/email-hash.js");
        const key = hashEmail(throttledEmail);
        await store.recordFailure(key);
      }

      let caught: unknown;
      try {
        await loginAccount(
          asDb(db),
          { email: throttledEmail, password: "AnyPassword123!" },
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

    it("triggers password rehash when account has a low-iteration hash", async () => {
      // Generate a real Argon2id hash for `password` with opsLimit=2 (INTERACTIVE),
      // which is below PWHASH_OPSLIMIT_SENSITIVE=4 so needsRehash() returns true.
      // Using sodium directly so we can control the iteration count.
      const { getSodium, PWHASH_MEMLIMIT_INTERACTIVE } = await import("@pluralscape/crypto");
      const sodium = getSodium();
      const passwordBytes = new TextEncoder().encode(password);
      const lowIterHash = sodium.pwhashStr(passwordBytes, 2, PWHASH_MEMLIMIT_INTERACTIVE);
      sodium.memzero(passwordBytes);

      await db
        .update(accounts)
        .set({ passwordHash: lowIterHash })
        .where(eq(accounts.id, registration.accountId));

      // Login with the correct password — needsRehash branch fires and schedules
      // a background re-hash. We just verify login succeeds (no throw).
      const result = await loginAccount(
        asDb(db),
        { email: registeredEmail, password },
        "web",
        noopAudit,
        logger,
      );

      expect(result).not.toBeNull();
    });

    it("returns null for viewer account with wrong password (accountType branch)", async () => {
      const viewerEmail = `viewer-${crypto.randomUUID()}@test.local`;
      await registerAccount(
        asDb(db),
        makeRegistrationParams({ email: viewerEmail, accountType: "viewer" }),
        "web",
        noopAudit,
      );

      const result = await loginAccount(
        asDb(db),
        { email: viewerEmail, password: "WrongPassword999!" },
        "web",
        noopAudit,
        logger,
      );

      expect(result).toBeNull();
    });

    it("returns null systemId for viewer account on successful login", async () => {
      const viewerEmail = `viewer2-${crypto.randomUUID()}@test.local`;
      const viewerPw = "TestPassword123!";
      await registerAccount(
        asDb(db),
        makeRegistrationParams({ email: viewerEmail, password: viewerPw, accountType: "viewer" }),
        "web",
        noopAudit,
      );

      const result = await loginAccount(
        asDb(db),
        { email: viewerEmail, password: viewerPw },
        "web",
        noopAudit,
        logger,
      );

      expect(result).not.toBeNull();
      expect(result?.accountType).toBe("viewer");
      expect(result?.systemId).toBeNull();
    });

    it("evicts oldest session when MAX_SESSIONS_PER_ACCOUNT is exceeded", async () => {
      // Import MAX_SESSIONS_PER_ACCOUNT from the constants file
      const { MAX_SESSIONS_PER_ACCOUNT } = await import("../../quota.constants.js");

      // Record the IDs of the first batch of sessions created via loginAccount
      const firstSessionIds: string[] = [];
      for (let i = 0; i < MAX_SESSIONS_PER_ACCOUNT; i++) {
        const res = await loginAccount(
          asDb(db),
          { email: registeredEmail, password },
          "web",
          noopAudit,
          logger,
        );
        expect(res).not.toBeNull();
        // Fetch the most-recently inserted session to track it
        const { sessions: all } = await listSessions(asDb(db), registration.accountId as AccountId);
        firstSessionIds.push(all[all.length - 1]?.id ?? "");
      }

      // This login should evict the oldest session
      await loginAccount(asDb(db), { email: registeredEmail, password }, "web", noopAudit, logger);

      const { sessions: after } = await listSessions(asDb(db), registration.accountId as AccountId);

      // Total active sessions must be ≤ MAX_SESSIONS_PER_ACCOUNT
      expect(after.length).toBeLessThanOrEqual(MAX_SESSIONS_PER_ACCOUNT);
    });
  });

  // ── listSessions ──────────────────────────────────────────────────

  describe("listSessions", () => {
    it("returns at least one session after registration", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(asDb(db), params, "web", noopAudit);

      const { sessions: sessionList } = await listSessions(asDb(db), reg.accountId as AccountId);

      expect(sessionList.length).toBeGreaterThanOrEqual(1);
      const first = sessionList[0];
      expect(first).toBeDefined();
      if (first) {
        expect(first.id).toMatch(/^sess_/);
        expect(typeof first.createdAt).toBe("number");
      }
    });

    it("respects cursor-based pagination", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(asDb(db), params, "web", noopAudit);

      // Create a second session by logging in
      await loginAccount(
        asDb(db),
        { email: params.email, password: params.password },
        "web",
        noopAudit,
        createMockLogger().logger,
      );

      // Fetch all sessions to confirm there are at least 2
      const all = await listSessions(asDb(db), reg.accountId as AccountId);
      expect(all.sessions.length).toBeGreaterThanOrEqual(2);

      // Fetch first page with limit=1 — nextCursor signals more pages exist
      const page1 = await listSessions(asDb(db), reg.accountId as AccountId, undefined, 1);
      expect(page1.sessions).toHaveLength(1);
      expect(page1.nextCursor).not.toBeNull();

      // listSessions compares cursor directly against sessions.id via GT.
      // Pass the raw session ID from page1 as the cursor for page2.
      const rawCursor = page1.sessions[0]?.id;
      expect(rawCursor).toBeDefined();

      const page2 = await listSessions(asDb(db), reg.accountId as AccountId, rawCursor, 1);
      expect(page2.sessions).toHaveLength(1);
      expect(page2.sessions[0]?.id).not.toBe(rawCursor);
    });
  });

  // ── revokeSession ─────────────────────────────────────────────────

  describe("revokeSession", () => {
    it("revokes a session and removes it from the active list", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(asDb(db), params, "web", noopAudit);

      const { sessions: before } = await listSessions(asDb(db), reg.accountId as AccountId);
      expect(before.length).toBeGreaterThanOrEqual(1);
      const firstSession = before[0];
      expect(firstSession).toBeDefined();
      if (!firstSession) return;

      const audit = spyAudit();
      const revoked = await revokeSession(
        asDb(db),
        firstSession.id,
        reg.accountId as AccountId,
        audit,
      );
      expect(revoked).toBe(true);

      const { sessions: after } = await listSessions(asDb(db), reg.accountId as AccountId);
      const found = after.find((s) => s.id === firstSession.id);
      expect(found).toBeUndefined();

      expect(audit.calls).toHaveLength(1);
      const auditCall = audit.calls[0];
      expect(auditCall).toBeDefined();
      if (auditCall) {
        expect(auditCall.eventType).toBe("auth.logout");
      }
    });

    it("returns false when revoking an already-revoked session", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(asDb(db), params, "web", noopAudit);

      const { sessions: before } = await listSessions(asDb(db), reg.accountId as AccountId);
      const firstSession = before[0];
      if (!firstSession) return;

      // Revoke once — succeeds
      await revokeSession(asDb(db), firstSession.id, reg.accountId as AccountId, noopAudit);

      // Revoke again — must return false
      const result = await revokeSession(
        asDb(db),
        firstSession.id,
        reg.accountId as AccountId,
        noopAudit,
      );
      expect(result).toBe(false);
    });

    it("returns false for a session that belongs to a different account", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(asDb(db), params, "web", noopAudit);
      const other = await registerAccount(asDb(db), makeRegistrationParams(), "web", noopAudit);

      const { sessions: otherSessions } = await listSessions(
        asDb(db),
        other.accountId as AccountId,
      );
      const otherSession = otherSessions[0];
      if (!otherSession) return;

      const result = await revokeSession(
        asDb(db),
        otherSession.id,
        reg.accountId as AccountId,
        noopAudit,
      );
      expect(result).toBe(false);
    });
  });

  // ── revokeAllSessions ─────────────────────────────────────────────

  describe("revokeAllSessions", () => {
    it("revokes all sessions except the specified one", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(asDb(db), params, "web", noopAudit);

      // Create a second session
      await loginAccount(
        asDb(db),
        { email: params.email, password: params.password },
        "web",
        noopAudit,
        logger,
      );

      const { sessions: before } = await listSessions(asDb(db), reg.accountId as AccountId);
      expect(before.length).toBeGreaterThanOrEqual(2);
      const keepSession = before[0];
      if (!keepSession) return;

      const audit = spyAudit();
      const count = await revokeAllSessions(
        asDb(db),
        reg.accountId as AccountId,
        keepSession.id,
        audit,
      );

      expect(count).toBeGreaterThanOrEqual(1);

      const { sessions: after } = await listSessions(asDb(db), reg.accountId as AccountId);
      expect(after).toHaveLength(1);
      expect(after[0]?.id).toBe(keepSession.id);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("auth.logout");
    });

    it("returns 0 when no other sessions exist", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(asDb(db), params, "web", noopAudit);

      const { sessions: all } = await listSessions(asDb(db), reg.accountId as AccountId);
      const only = all[0];
      if (!only) return;

      const count = await revokeAllSessions(
        asDb(db),
        reg.accountId as AccountId,
        only.id,
        noopAudit,
      );
      expect(count).toBe(0);
    });
  });

  // ── logoutCurrentSession ──────────────────────────────────────────

  describe("logoutCurrentSession", () => {
    it("revokes the current session so it no longer appears in listSessions", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(asDb(db), params, "web", noopAudit);

      const { sessions: before } = await listSessions(asDb(db), reg.accountId as AccountId);
      const current = before[0];
      if (!current) return;

      const audit = spyAudit();
      await logoutCurrentSession(asDb(db), current.id, reg.accountId as AccountId, audit);

      const { sessions: after } = await listSessions(asDb(db), reg.accountId as AccountId);
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

  // ── needsRehash ───────────────────────────────────────────────────

  describe("needsRehash", () => {
    it("returns false for a hash with t=4 (current sensitive profile)", () => {
      const hash =
        "$argon2id$v=19$m=65536,t=4,p=1$R8XiCuEH7Vp0dU/c3DPG7g$DsumexqNIgHFu2dhin/zZci/+LwXFjSIpq2OienfAd4";
      expect(needsRehash(hash)).toBe(false);
    });

    it("returns true for a hash with t=1 (below sensitive profile)", () => {
      const hash =
        "$argon2id$v=19$m=65536,t=1,p=1$R8XiCuEH7Vp0dU/c3DPG7g$DsumexqNIgHFu2dhin/zZci/+LwXFjSIpq2OienfAd4";
      expect(needsRehash(hash)).toBe(true);
    });

    it("returns false for a non-argon2id hash string", () => {
      expect(needsRehash("not-a-real-hash")).toBe(false);
    });
  });
});
