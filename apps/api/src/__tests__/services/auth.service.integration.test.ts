import { PGlite } from "@electric-sql/pglite";
import { initSodium } from "@pluralscape/crypto";
import { accounts, authKeys, recoveryKeys, sessions, systems } from "@pluralscape/db/pg";
import { createPgAuthTables, PG_DDL, pgExec } from "@pluralscape/db/test-helpers/pg-helpers";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Ensure EMAIL_HASH_PEPPER is available before env.ts is evaluated.
// The env module reads process.env at import time; in CI or local dev the
// variable may not be set, which causes hashEmail to throw.
vi.hoisted(() => {
  process.env["EMAIL_HASH_PEPPER"] ??= "ab".repeat(32);
});

import { _resetAccountLoginStoreForTesting } from "../../middleware/stores/account-login-store.js";
import {
  listSessions,
  loginAccount,
  registerAccount,
  revokeSession,
} from "../../services/auth.service.js";
import { noopAudit, spyAudit } from "../helpers/integration-setup.js";
import { createMockLogger } from "../helpers/mock-logger.js";

import type { RegistrationResult } from "../../services/auth.service.js";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const schema = { accounts, authKeys, recoveryKeys, sessions, systems };

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

  function makeRegistrationParams(overrides: { email?: string; password?: string } = {}): {
    email: string;
    password: string;
    accountType: "system";
    recoveryKeyBackupConfirmed: true;
  } {
    return {
      email: overrides.email ?? `test-${crypto.randomUUID()}@test.local`,
      password: overrides.password ?? "TestPassword123!",
      accountType: "system",
      recoveryKeyBackupConfirmed: true,
    };
  }

  // ── registerAccount ────────────────────────────────────────────────

  describe("registerAccount", () => {
    it("succeeds and returns sessionToken, recoveryKey, accountId, and accountType", async () => {
      const params = makeRegistrationParams();
      const result = await registerAccount(db as never, params, "web", noopAudit);

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

      await registerAccount(db as never, params, "web", noopAudit);

      let caught: unknown;
      try {
        await registerAccount(db as never, params, "web", noopAudit);
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
  });

  // ── loginAccount ───────────────────────────────────────────────────

  describe("loginAccount", () => {
    let registeredEmail: string;
    let registration: RegistrationResult;
    const password = "TestPassword123!";

    beforeEach(async () => {
      registeredEmail = `login-${crypto.randomUUID()}@test.local`;
      registration = await registerAccount(
        db as never,
        makeRegistrationParams({ email: registeredEmail, password }),
        "web",
        noopAudit,
      );
    });

    it("returns session token with correct credentials", async () => {
      const result = await loginAccount(
        db as never,
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
        db as never,
        { email: registeredEmail, password: "WrongPassword999!" },
        "web",
        noopAudit,
        logger,
      );

      expect(result).toBeNull();
    });

    it("returns null for non-existent account (anti-enumeration)", async () => {
      const result = await loginAccount(
        db as never,
        { email: `nonexistent-${crypto.randomUUID()}@test.local`, password: "SomePassword123!" },
        "web",
        noopAudit,
        logger,
      );

      expect(result).toBeNull();
    });
  });

  // ── listSessions ──────────────────────────────────────────────────

  describe("listSessions", () => {
    it("returns at least one session after registration", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(db as never, params, "web", noopAudit);

      const { sessions: sessionList } = await listSessions(db as never, reg.accountId);

      expect(sessionList.length).toBeGreaterThanOrEqual(1);
      const first = sessionList[0];
      expect(first).toBeDefined();
      if (first) {
        expect(first.id).toMatch(/^sess_/);
        expect(typeof first.createdAt).toBe("number");
      }
    });
  });

  // ── revokeSession ─────────────────────────────────────────────────

  describe("revokeSession", () => {
    it("revokes a session and removes it from the active list", async () => {
      const params = makeRegistrationParams();
      const reg = await registerAccount(db as never, params, "web", noopAudit);

      const { sessions: before } = await listSessions(db as never, reg.accountId);
      expect(before.length).toBeGreaterThanOrEqual(1);
      const firstSession = before[0];
      expect(firstSession).toBeDefined();
      if (!firstSession) return;

      const audit = spyAudit();
      const revoked = await revokeSession(db as never, firstSession.id, reg.accountId, audit);
      expect(revoked).toBe(true);

      const { sessions: after } = await listSessions(db as never, reg.accountId);
      const found = after.find((s) => s.id === firstSession.id);
      expect(found).toBeUndefined();

      expect(audit.calls).toHaveLength(1);
      const auditCall = audit.calls[0];
      expect(auditCall).toBeDefined();
      if (auditCall) {
        expect(auditCall.eventType).toBe("auth.logout");
      }
    });
  });
});
