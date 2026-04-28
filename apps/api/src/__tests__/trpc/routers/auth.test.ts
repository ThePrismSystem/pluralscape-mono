import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MOCK_SYSTEM_ID,
  MOCK_AUTH,
  makeCallerFactory,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { SessionId } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/recovery-key/reset-password.js", () => ({
  resetPasswordWithRecoveryKey: vi.fn(),
}));

vi.mock("../../../services/recovery-key/internal.js", () => ({
  NoActiveRecoveryKeyError: class NoActiveRecoveryKeyError extends Error {
    override readonly name = "NoActiveRecoveryKeyError" as const;
  },
}));

vi.mock("../../../services/auth/register.js", () => ({
  initiateRegistration: vi.fn(),
  commitRegistration: vi.fn(),
  ValidationError: class ValidationError extends Error {
    override readonly name = "ValidationError" as const;
  },
}));

vi.mock("../../../services/auth/login.js", () => ({
  loginAccount: vi.fn(),
  LoginThrottledError: class LoginThrottledError extends Error {
    override readonly name = "LoginThrottledError" as const;
    readonly windowResetAt: number;
    constructor(windowResetAt: number) {
      super("Too many failed login attempts");
      this.windowResetAt = windowResetAt;
    }
  },
}));

vi.mock("../../../services/auth/sessions.js", () => ({
  logoutCurrentSession: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

const { initiateRegistration, commitRegistration } =
  await import("../../../services/auth/register.js");
const { loginAccount, LoginThrottledError } = await import("../../../services/auth/login.js");
const { logoutCurrentSession, listSessions, revokeSession, revokeAllSessions } =
  await import("../../../services/auth/sessions.js");

const { resetPasswordWithRecoveryKey } =
  await import("../../../services/recovery-key/reset-password.js");
const { NoActiveRecoveryKeyError } = await import("../../../services/recovery-key/internal.js");

const { authRouter } = await import("../../../trpc/routers/auth.js");

const createCaller = makeCallerFactory({ auth: authRouter });

const MOCK_OTHER_SESSION_ID = brandId<SessionId>("sess_660e8400-e29b-41d4-a716-446655440002");

describe("auth router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── registrationInitiate ─────────────────────────────────────────

  describe("auth.registrationInitiate", () => {
    const initiateInput = {
      email: "test@example.com",
    };

    const initiateResult = {
      accountId: MOCK_AUTH.accountId,
      kdfSalt: "b".repeat(32),
      challengeNonce: "n".repeat(64),
    };

    it("calls initiateRegistration and returns initiate result", async () => {
      vi.mocked(initiateRegistration).mockResolvedValue(initiateResult);
      const caller = createCaller();
      const result = await caller.auth.registrationInitiate(initiateInput);

      expect(vi.mocked(initiateRegistration)).toHaveBeenCalledOnce();
      expect(result).toEqual(initiateResult);
    });

    it("does not require authentication", async () => {
      vi.mocked(initiateRegistration).mockResolvedValue(initiateResult);
      const caller = createCaller(null);
      await expect(caller.auth.registrationInitiate(initiateInput)).resolves.toEqual(
        initiateResult,
      );
    });

    it("rejects invalid email format", async () => {
      const caller = createCaller();
      await expect(caller.auth.registrationInitiate({ email: "not-an-email" })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    it("applies authHeavy rate limiting", async () => {
      const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
      vi.mocked(initiateRegistration).mockResolvedValue(initiateResult);
      const caller = createCaller(null);
      await assertProcedureRateLimited(
        vi.mocked(checkRateLimit),
        () => caller.auth.registrationInitiate(initiateInput),
        "authHeavy",
      );
    });
  });

  // ── registrationCommit ────────────────────────────────────────────

  describe("auth.registrationCommit", () => {
    const commitInput = {
      accountId: MOCK_AUTH.accountId,
      authKey: "a".repeat(64),
      encryptedMasterKey: "ab".repeat(40),
      encryptedSigningPrivateKey: "ab".repeat(40),
      encryptedEncryptionPrivateKey: "ab".repeat(40),
      publicSigningKey: "a".repeat(64),
      publicEncryptionKey: "b".repeat(64),
      recoveryEncryptedMasterKey: "ab".repeat(40),
      challengeSignature: "c".repeat(128),
      recoveryKeyBackupConfirmed: true,
      recoveryKeyHash: "a".repeat(64),
    };

    const commitResult = {
      sessionToken: "tok_abc",
      accountId: MOCK_AUTH.accountId,
      accountType: "system" as const,
    };

    it("calls commitRegistration and defaults platform to 'web'", async () => {
      vi.mocked(commitRegistration).mockResolvedValue(commitResult);
      const caller = createCaller();
      const result = await caller.auth.registrationCommit(commitInput);

      expect(vi.mocked(commitRegistration)).toHaveBeenCalledOnce();
      expect(vi.mocked(commitRegistration).mock.calls[0]?.[2]).toBe("web");
      expect(result).toEqual(commitResult);
    });

    it("accepts explicit platform override", async () => {
      vi.mocked(commitRegistration).mockResolvedValue(commitResult);
      const caller = createCaller();
      await caller.auth.registrationCommit({ ...commitInput, platform: "mobile" });

      expect(vi.mocked(commitRegistration).mock.calls[0]?.[2]).toBe("mobile");
    });

    it("does not require authentication", async () => {
      vi.mocked(commitRegistration).mockResolvedValue(commitResult);
      const caller = createCaller(null);
      await expect(caller.auth.registrationCommit(commitInput)).resolves.toEqual(commitResult);
    });
  });

  // ── login ─────────────────────────────────────────────────────────

  describe("auth.login", () => {
    const loginInput = { email: "test@example.com", authKey: "aa".repeat(32) };

    const loginResult = {
      sessionToken: "tok_xyz",
      accountId: MOCK_AUTH.accountId,
      systemId: MOCK_SYSTEM_ID,
      accountType: "system" as const,
      encryptedMasterKey: "deadbeef",
      kdfSalt: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    };

    it("returns result when credentials are valid", async () => {
      vi.mocked(loginAccount).mockResolvedValue(loginResult);
      const caller = createCaller();
      const result = await caller.auth.login(loginInput);
      expect(result).toEqual(loginResult);
    });

    it("throws UNAUTHORIZED when loginAccount returns null", async () => {
      vi.mocked(loginAccount).mockResolvedValue(null);
      const caller = createCaller();
      await expect(caller.auth.login(loginInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws TOO_MANY_REQUESTS when LoginThrottledError is thrown", async () => {
      vi.mocked(loginAccount).mockRejectedValue(new LoginThrottledError(Date.now() + 60_000));
      const caller = createCaller();
      await expect(caller.auth.login(loginInput)).rejects.toThrow(
        expect.objectContaining({ code: "TOO_MANY_REQUESTS" }),
      );
    });

    it("applies authHeavy rate limiting", async () => {
      const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
      vi.mocked(loginAccount).mockResolvedValue(loginResult);
      const caller = createCaller(null);
      await assertProcedureRateLimited(
        vi.mocked(checkRateLimit),
        () => caller.auth.login(loginInput),
        "authHeavy",
      );
    });
  });

  // ── resetPasswordWithRecoveryKey ──────────────────────────────────

  describe("auth.resetPasswordWithRecoveryKey", () => {
    const resetInput = {
      email: "test@example.com",
      newAuthKey: "a".repeat(64),
      newKdfSalt: "b".repeat(32),
      newEncryptedMasterKey: "ab".repeat(40),
      newRecoveryEncryptedMasterKey: "ab".repeat(40),
      recoveryKeyHash: "a".repeat(64),
      newRecoveryKeyHash: "b".repeat(64),
    };

    const resetResult = {
      sessionToken: brandId<SessionId>("sess_550e8400-e29b-41d4-a716-446655440099"),
      accountId: MOCK_AUTH.accountId,
    };

    it("returns result on success", async () => {
      vi.mocked(resetPasswordWithRecoveryKey).mockResolvedValue(resetResult);
      const caller = createCaller(null);
      const result = await caller.auth.resetPasswordWithRecoveryKey(resetInput);
      expect(result).toEqual(resetResult);
    });

    it("throws UNAUTHORIZED when service returns null", async () => {
      vi.mocked(resetPasswordWithRecoveryKey).mockResolvedValue(null);
      const caller = createCaller(null);
      await expect(caller.auth.resetPasswordWithRecoveryKey(resetInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws UNAUTHORIZED when NoActiveRecoveryKeyError is thrown", async () => {
      vi.mocked(resetPasswordWithRecoveryKey).mockRejectedValue(new NoActiveRecoveryKeyError());
      const caller = createCaller(null);
      await expect(caller.auth.resetPasswordWithRecoveryKey(resetInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("rethrows unknown errors from service as INTERNAL_SERVER_ERROR", async () => {
      vi.mocked(resetPasswordWithRecoveryKey).mockRejectedValue(new Error("database exploded"));
      const caller = createCaller(null);
      await expect(caller.auth.resetPasswordWithRecoveryKey(resetInput)).rejects.toThrow(
        expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }),
      );
    });
  });

  // ── login error rethrow ───────────────────────────────────────────

  describe("auth.login (error rethrow)", () => {
    it("rethrows unknown errors from loginAccount as INTERNAL_SERVER_ERROR", async () => {
      vi.mocked(loginAccount).mockRejectedValue(new Error("unexpected db failure"));
      const caller = createCaller(null);
      await expect(
        caller.auth.login({ email: "test@example.com", authKey: "aa".repeat(32) }),
      ).rejects.toThrow(expect.objectContaining({ code: "INTERNAL_SERVER_ERROR" }));
    });
  });

  // ── logout ────────────────────────────────────────────────────────

  describe("auth.logout", () => {
    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.auth.logout()).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("calls logoutCurrentSession and returns success", async () => {
      vi.mocked(logoutCurrentSession).mockResolvedValue(undefined);
      const caller = createCaller(MOCK_AUTH);
      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(vi.mocked(logoutCurrentSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(logoutCurrentSession).mock.calls[0]?.[1]).toBe(MOCK_AUTH.sessionId);
      expect(vi.mocked(logoutCurrentSession).mock.calls[0]?.[2]).toBe(MOCK_AUTH.accountId);
    });
  });

  // ── session.list ──────────────────────────────────────────────────

  describe("auth.session.list", () => {
    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.auth.session.list({})).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("returns paginated sessions", async () => {
      const mockResult = {
        sessions: [
          {
            id: brandId<SessionId>("sess_1"),
            createdAt: 1000,
            lastActive: 2000,
            expiresAt: null,
            encryptedData: null,
          },
        ],
        nextCursor: null,
      };
      vi.mocked(listSessions).mockResolvedValue(mockResult);
      const caller = createCaller(MOCK_AUTH);
      const result = await caller.auth.session.list({});
      expect(result).toEqual(mockResult);
    });

    it("passes cursor and limit", async () => {
      vi.mocked(listSessions).mockResolvedValue({ sessions: [], nextCursor: null });
      const caller = createCaller(MOCK_AUTH);
      await caller.auth.session.list({ cursor: "cur_abc", limit: 10 });

      expect(vi.mocked(listSessions).mock.calls[0]?.[2]).toBe("cur_abc");
      expect(vi.mocked(listSessions).mock.calls[0]?.[3]).toBe(10);
    });

    it("rejects limit exceeding maximum", async () => {
      const caller = createCaller(MOCK_AUTH);
      await expect(caller.auth.session.list({ limit: 200 })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });

  // ── session.revoke ────────────────────────────────────────────────

  describe("auth.session.revoke", () => {
    it("throws BAD_REQUEST when revoking the current session", async () => {
      const caller = createCaller(MOCK_AUTH);
      await expect(caller.auth.session.revoke({ sessionId: MOCK_AUTH.sessionId })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    it("throws NOT_FOUND when revokeSession returns false", async () => {
      vi.mocked(revokeSession).mockResolvedValue(false);
      const caller = createCaller(MOCK_AUTH);
      await expect(
        caller.auth.session.revoke({ sessionId: MOCK_OTHER_SESSION_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("returns success when session is revoked", async () => {
      vi.mocked(revokeSession).mockResolvedValue(true);
      const caller = createCaller(MOCK_AUTH);
      const result = await caller.auth.session.revoke({ sessionId: MOCK_OTHER_SESSION_ID });
      expect(result).toEqual({ revoked: true });
    });

    it("rejects invalid sessionId format", async () => {
      const caller = createCaller(MOCK_AUTH);
      await expect(
        caller.auth.session.revoke({ sessionId: brandId<SessionId>("not-valid") }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── session.revokeAll ─────────────────────────────────────────────

  describe("auth.session.revokeAll", () => {
    it("returns count of revoked sessions", async () => {
      vi.mocked(revokeAllSessions).mockResolvedValue(3);
      const caller = createCaller(MOCK_AUTH);
      const result = await caller.auth.session.revokeAll();
      expect(result).toEqual({ revokedCount: 3 });
    });

    it("passes current sessionId as exception", async () => {
      vi.mocked(revokeAllSessions).mockResolvedValue(0);
      const caller = createCaller(MOCK_AUTH);
      await caller.auth.session.revokeAll();

      expect(vi.mocked(revokeAllSessions).mock.calls[0]?.[2]).toBe(MOCK_AUTH.sessionId);
    });
  });
});
