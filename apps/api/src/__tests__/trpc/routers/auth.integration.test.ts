import { randomBytes } from "node:crypto";

import {
  assertAuthKey,
  hashAuthKey,
  hashRecoveryKey,
  initSodium,
  toHex,
} from "@pluralscape/crypto";
import { accounts, recoveryKeys } from "@pluralscape/db/pg";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Ensure EMAIL_HASH_PEPPER is available before env.ts is evaluated. The env
// module reads process.env at import time; without this, hashEmail throws.
vi.hoisted(() => {
  process.env["EMAIL_HASH_PEPPER"] ??= "ab".repeat(32);
});

// Hoisted mocks for dispatch-style external services. This same block lives at
// the top of every router integration test file. Keep these BEFORE any
// module-level import that could transitively pull in the real implementations.
vi.mock("../../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));
vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

import { requireSession } from "../../../lib/auth-context.js";
import { hashEmail } from "../../../lib/email-hash.js";
import { checkRateLimit } from "../../../middleware/rate-limit.js";
import { _resetAccountLoginStoreForTesting } from "../../../middleware/stores/account-login-store.js";
import { loginAccount } from "../../../services/auth/login.js";
import { listSessions } from "../../../services/auth/sessions.js";
import { dispatchWebhookEvent } from "../../../services/webhook-dispatcher.js";
import { authRouter } from "../../../trpc/routers/auth.js";
import { noopAudit, registerTestAccount } from "../../helpers/integration-setup.js";
import { createMockLogger } from "../../helpers/mock-logger.js";
import { setupRouterFixture } from "../integration-helpers.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { AccountId, RecoveryKeyId, SessionId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Default page size expected from session.list when no cursor is supplied. */
const DEFAULT_EXPECTED_SESSIONS_MIN = 1;

/** Random-byte length used for recovery-key and blob fixtures. */
const RECOVERY_KEY_BYTES = 32;
const MASTER_KEY_BLOB_BYTES = 72;

/** Build a minimal AuthContext matching a real session row on `accountId`. */
function makeSessionAuth(
  accountId: AccountId,
  systemId: SystemId | null,
  sessionId: SessionId,
): AuthContext {
  return {
    authMethod: "session" as const,
    accountId,
    systemId,
    sessionId,
    accountType: "system",
    ownedSystemIds: systemId ? new Set([systemId]) : new Set<SystemId>(),
    auditLogIpTracking: false,
  };
}

/**
 * Register a real account and return an AuthContext wired to the first active
 * session. The session is created by `registerTestAccount`'s commit phase, so
 * the sessionId exists in the DB and `revokeSession` / `logoutCurrentSession`
 * will find it.
 */
async function registerAndBuildAuth(db: PostgresJsDatabase): Promise<{
  readonly accountId: AccountId;
  readonly authKeyHex: string;
  readonly email: string;
  readonly auth: AuthContext;
}> {
  const reg = await registerTestAccount(db);
  const accountId = brandId<AccountId>(reg.accountId);
  const { sessions: sessionList } = await listSessions(db, accountId);
  const first = sessionList[0];
  if (!first) throw new Error("expected at least one session after registration");
  const sessionId = brandId<SessionId>(first.id);
  // registerTestAccount seeds accountType "system" and creates a system row;
  // we don't track the branded systemId on the return value, so pass null —
  // the auth router's logout/session procedures only key off accountId.
  return {
    accountId,
    authKeyHex: reg.authKeyHex,
    email: reg.email,
    auth: makeSessionAuth(accountId, null, sessionId),
  };
}

/**
 * Insert a test account with a KNOWN recovery key so
 * resetPasswordWithRecoveryKey can succeed. The real registerTestAccount
 * stores a random 32-byte blob as the "recovery key hash" rather than the
 * BLAKE2b hash of a raw key, so its fixture cannot round-trip through a
 * reset flow.
 */
async function insertAccountWithKnownRecoveryKey(db: PostgresJsDatabase): Promise<{
  readonly email: string;
  readonly recoveryKeyHex: string;
}> {
  const email = `reset-${crypto.randomUUID()}@test.local`;
  const accountId = `acct_${crypto.randomUUID()}`;
  const recoveryKeyId = brandId<RecoveryKeyId>(`rk_${crypto.randomUUID()}`);
  // randomBytes returns Node's Buffer; coerce to plain Uint8Array so the
  // branded `AuthKeyMaterial` assertion narrows correctly.
  const rawAuthKey = new Uint8Array(randomBytes(RECOVERY_KEY_BYTES));
  assertAuthKey(rawAuthKey);
  const rawRecoveryKey = new Uint8Array(randomBytes(RECOVERY_KEY_BYTES));
  const recoveryKeyHash = hashRecoveryKey(rawRecoveryKey);
  const timestamp = toUnixMillis(Date.now());

  await db.insert(accounts).values({
    id: brandId<AccountId>(accountId),
    accountType: "system",
    emailHash: hashEmail(email),
    emailSalt: toHex(new Uint8Array(randomBytes(16))),
    authKeyHash: hashAuthKey(rawAuthKey),
    kdfSalt: toHex(new Uint8Array(randomBytes(16))),
    encryptedMasterKey: new Uint8Array(randomBytes(MASTER_KEY_BLOB_BYTES)),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.insert(recoveryKeys).values({
    id: recoveryKeyId,
    accountId: brandId<AccountId>(accountId),
    encryptedMasterKey: new Uint8Array(randomBytes(MASTER_KEY_BLOB_BYTES)),
    recoveryKeyHash,
    createdAt: timestamp,
  });

  return { email, recoveryKeyHex: toHex(rawRecoveryKey) };
}

describe("auth router integration", () => {
  // The auth router exercises real session/login flows that mutate the
  // in-memory account-login backoff store; reset it between tests so
  // anti-enumeration timing carryover doesn't bleed across cases.
  const fixture = setupRouterFixture(
    { auth: authRouter },
    {
      extraAfterEach: () => {
        _resetAccountLoginStoreForTesting();
      },
      clearMocks: () => {
        vi.mocked(dispatchWebhookEvent).mockClear();
        vi.mocked(checkRateLimit).mockClear();
      },
    },
  );

  beforeAll(async () => {
    await initSodium();
  });

  describe("auth.registrationInitiate", () => {
    it("returns kdfSalt and challengeNonce for a fresh email (public, no auth)", async () => {
      const caller = fixture.getCaller(null);
      const email = `init-${crypto.randomUUID()}@test.local`;
      const result = await caller.auth.registrationInitiate({ email });
      expect(result.accountId).toMatch(/^acct_/);
      // hex-encoded salt + nonce — non-empty even on the anti-enumeration path.
      expect(result.kdfSalt.length).toBeGreaterThan(0);
      expect(result.challengeNonce.length).toBeGreaterThan(0);
    });
  });

  describe("auth.registrationCommit", () => {
    // registrationCommit requires a phase-1 account plus a valid challenge
    // signature derived from a signing keypair we own. Constructing all of
    // that by hand duplicates `registerTestAccount` wholesale, so we exercise
    // commit through the helper and assert on its result shape — which is
    // exactly what the tRPC procedure returns.
    it("completes phase 2 via the real two-phase flow", async () => {
      const reg = await registerTestAccount(fixture.getCtx().db);
      expect(typeof reg.sessionToken).toBe("string");
      expect(reg.sessionToken.length).toBeGreaterThan(0);
      expect(reg.accountId).toMatch(/^acct_/);
      expect(reg.accountType).toBe("system");
    });

    it("rejects a malformed commit (missing crypto fields)", async () => {
      // Stand up a real phase-1 account shell first so the failure is
      // validation, not lookup.
      const caller = fixture.getCaller(null);
      const init = await caller.auth.registrationInitiate({
        email: `bad-${crypto.randomUUID()}@test.local`,
      });
      await expect(
        caller.auth.registrationCommit({
          accountId: init.accountId,
          // deliberately bogus placeholders — schema requires .min(1) so
          // they'll pass parsing, but crypto assertions inside the service
          // will throw once fromHex/assertSignature run.
          authKey: "zz",
          encryptedMasterKey: "zz",
          encryptedSigningPrivateKey: "zz",
          encryptedEncryptionPrivateKey: "zz",
          publicSigningKey: "zz",
          publicEncryptionKey: "zz",
          recoveryEncryptedMasterKey: "zz",
          challengeSignature: "zz",
          recoveryKeyBackupConfirmed: true,
          recoveryKeyHash: "zz",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  describe("auth.login", () => {
    it("returns a session token for valid credentials", async () => {
      const reg = await registerTestAccount(fixture.getCtx().db);
      const caller = fixture.getCaller(null);
      const result = await caller.auth.login({
        email: reg.email,
        authKey: reg.authKeyHex,
      });
      expect(result.accountId).toBe(reg.accountId);
      expect(result.accountType).toBe("system");
      expect(typeof result.sessionToken).toBe("string");
      expect(result.sessionToken.length).toBeGreaterThan(0);
      expect(vi.mocked(checkRateLimit)).toHaveBeenCalled();
    });

    it("throws UNAUTHORIZED for a wrong auth key", async () => {
      const reg = await registerTestAccount(fixture.getCtx().db);
      const caller = fixture.getCaller(null);
      await expect(
        caller.auth.login({ email: reg.email, authKey: "ff".repeat(RECOVERY_KEY_BYTES) }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws UNAUTHORIZED for a nonexistent email (anti-enumeration)", async () => {
      const caller = fixture.getCaller(null);
      await expect(
        caller.auth.login({
          email: `ghost-${crypto.randomUUID()}@test.local`,
          authKey: "aa".repeat(RECOVERY_KEY_BYTES),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  describe("auth.resetPasswordWithRecoveryKey", () => {
    it("resets password and returns a new session on success", async () => {
      const { email, recoveryKeyHex } = await insertAccountWithKnownRecoveryKey(
        fixture.getCtx().db,
      );
      const caller = fixture.getCaller(null);
      const result = await caller.auth.resetPasswordWithRecoveryKey({
        email,
        newAuthKey: toHex(new Uint8Array(randomBytes(RECOVERY_KEY_BYTES))),
        newKdfSalt: toHex(new Uint8Array(randomBytes(16))),
        newEncryptedMasterKey: toHex(new Uint8Array(randomBytes(MASTER_KEY_BLOB_BYTES))),
        newRecoveryEncryptedMasterKey: toHex(new Uint8Array(randomBytes(MASTER_KEY_BLOB_BYTES))),
        recoveryKeyHash: recoveryKeyHex,
        newRecoveryKeyHash: toHex(new Uint8Array(randomBytes(RECOVERY_KEY_BYTES))),
      });
      expect(typeof result.sessionToken).toBe("string");
      expect(result.sessionToken.length).toBeGreaterThan(0);
      expect(result.accountId).toMatch(/^acct_/);
    });

    it("throws UNAUTHORIZED for a nonexistent email (anti-enumeration)", async () => {
      const caller = fixture.getCaller(null);
      await expect(
        caller.auth.resetPasswordWithRecoveryKey({
          email: `ghost-${crypto.randomUUID()}@test.local`,
          newAuthKey: toHex(new Uint8Array(randomBytes(RECOVERY_KEY_BYTES))),
          newKdfSalt: toHex(new Uint8Array(randomBytes(16))),
          newEncryptedMasterKey: toHex(new Uint8Array(randomBytes(MASTER_KEY_BLOB_BYTES))),
          newRecoveryEncryptedMasterKey: toHex(new Uint8Array(randomBytes(MASTER_KEY_BLOB_BYTES))),
          recoveryKeyHash: toHex(new Uint8Array(randomBytes(RECOVERY_KEY_BYTES))),
          newRecoveryKeyHash: toHex(new Uint8Array(randomBytes(RECOVERY_KEY_BYTES))),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  describe("auth.logout", () => {
    it("revokes the current session and returns success", async () => {
      const { auth } = await registerAndBuildAuth(fixture.getCtx().db);
      const caller = fixture.getCaller(auth);
      const result = await caller.auth.logout();
      expect(result).toEqual({ success: true });
    });
  });

  describe("auth.session.list", () => {
    it("returns the caller's active sessions", async () => {
      const { auth } = await registerAndBuildAuth(fixture.getCtx().db);
      const caller = fixture.getCaller(auth);
      const result = await caller.auth.session.list({});
      expect(result.sessions.length).toBeGreaterThanOrEqual(DEFAULT_EXPECTED_SESSIONS_MIN);
      expect(result.sessions[0]?.id).toMatch(/^sess_/);
    });
  });

  describe("auth.session.revoke", () => {
    it("revokes a different session belonging to the caller's account", async () => {
      const db = fixture.getCtx().db;
      const { accountId, authKeyHex, email, auth } = await registerAndBuildAuth(db);
      // Log in again to create a second session; revoke THAT one — the
      // current sessionId is gated with BAD_REQUEST.
      const second = await loginAccount(
        db,
        { email, authKey: authKeyHex },
        "web",
        noopAudit,
        createMockLogger().logger,
      );
      expect(second).not.toBeNull();
      const currentSessionId = requireSession(auth).sessionId;
      const allSessions = await listSessions(db, accountId);
      const otherSession = allSessions.sessions.find((s) => s.id !== currentSessionId);
      if (!otherSession) throw new Error("expected a second session after re-login");
      const caller = fixture.getCaller(auth);
      const result = await caller.auth.session.revoke({
        sessionId: brandId<SessionId>(otherSession.id),
      });
      expect(result).toEqual({ revoked: true });
    });

    it("throws BAD_REQUEST when revoking the current session", async () => {
      const { auth } = await registerAndBuildAuth(fixture.getCtx().db);
      const currentSessionId = requireSession(auth).sessionId;
      const caller = fixture.getCaller(auth);
      await expect(caller.auth.session.revoke({ sessionId: currentSessionId })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });

  describe("auth.session.revokeAll", () => {
    it("revokes every session except the caller's current one", async () => {
      const db = fixture.getCtx().db;
      const { authKeyHex, email, auth } = await registerAndBuildAuth(db);
      // Create two additional sessions by logging in twice more.
      await loginAccount(
        db,
        { email, authKey: authKeyHex },
        "web",
        noopAudit,
        createMockLogger().logger,
      );
      await loginAccount(
        db,
        { email, authKey: authKeyHex },
        "web",
        noopAudit,
        createMockLogger().logger,
      );
      const caller = fixture.getCaller(auth);
      const result = await caller.auth.session.revokeAll();
      expect(result.revokedCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("auth", () => {
    it("rejects unauthenticated auth.logout with UNAUTHORIZED", async () => {
      const caller = fixture.getCaller(null);
      await expect(caller.auth.logout()).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("rejects unauthenticated auth.session.list with UNAUTHORIZED", async () => {
      const caller = fixture.getCaller(null);
      await expect(caller.auth.session.list({})).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  describe("account isolation", () => {
    it("rejects login when using account A's email with account B's auth key", async () => {
      const db = fixture.getCtx().db;
      // Two independently registered accounts. Each has a distinct authKey.
      // Attempting to log in as A using B's key must fail with UNAUTHORIZED.
      const accountA = await registerTestAccount(db);
      const accountB = await registerTestAccount(db);
      expect(accountA.authKeyHex).not.toBe(accountB.authKeyHex);
      const caller = fixture.getCaller(null);
      await expect(
        caller.auth.login({ email: accountA.email, authKey: accountB.authKeyHex }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("returns NOT_FOUND when revoking a session that belongs to a different account", async () => {
      const db = fixture.getCtx().db;
      const accountA = await registerAndBuildAuth(db);
      const accountB = await registerAndBuildAuth(db);
      // Ask A to revoke B's session — the WHERE clause scopes by accountId,
      // so the update affects zero rows and the procedure surfaces NOT_FOUND.
      const otherSessionId = requireSession(accountB.auth).sessionId;
      const callerA = fixture.getCaller(accountA.auth);
      await expect(callerA.auth.session.revoke({ sessionId: otherSessionId })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });
});
