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

vi.mock("../../../services/auth.service.js", () => ({
  registerAccount: vi.fn(),
  loginAccount: vi.fn(),
  logoutCurrentSession: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
  LoginThrottledError: class LoginThrottledError extends Error {
    override readonly name = "LoginThrottledError" as const;
    readonly windowResetAt: number;
    constructor(windowResetAt: number) {
      super("Too many failed login attempts");
      this.windowResetAt = windowResetAt;
    }
  },
  ValidationError: class ValidationError extends Error {
    override readonly name = "ValidationError" as const;
  },
}));

const {
  registerAccount,
  loginAccount,
  logoutCurrentSession,
  listSessions,
  revokeSession,
  revokeAllSessions,
  LoginThrottledError,
} = await import("../../../services/auth.service.js");

const { authRouter } = await import("../../../trpc/routers/auth.js");

const createCaller = makeCallerFactory({ auth: authRouter });

const MOCK_OTHER_SESSION_ID = "sess_660e8400-e29b-41d4-a716-446655440002" as SessionId;

describe("auth router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── register ──────────────────────────────────────────────────────

  describe("auth.register", () => {
    const registrationInput = {
      email: "test@example.com",
      password: "SuperSecret123!",
      recoveryKeyBackupConfirmed: true,
    };

    const registrationResult = {
      sessionToken: "tok_abc",
      recoveryKey: "XXXX-YYYY-ZZZZ",
      accountId: MOCK_AUTH.accountId,
      accountType: "system" as const,
    };

    it("calls registerAccount and defaults platform to 'web'", async () => {
      vi.mocked(registerAccount).mockResolvedValue(registrationResult);
      const caller = createCaller();
      const result = await caller.auth.register(registrationInput);

      expect(vi.mocked(registerAccount)).toHaveBeenCalledOnce();
      expect(vi.mocked(registerAccount).mock.calls[0]?.[2]).toBe("web");
      expect(result).toEqual(registrationResult);
    });

    it("accepts explicit platform override", async () => {
      vi.mocked(registerAccount).mockResolvedValue(registrationResult);
      const caller = createCaller();
      await caller.auth.register({ ...registrationInput, platform: "mobile" });

      expect(vi.mocked(registerAccount).mock.calls[0]?.[2]).toBe("mobile");
    });

    it("does not require authentication", async () => {
      vi.mocked(registerAccount).mockResolvedValue(registrationResult);
      const caller = createCaller(null);
      await expect(caller.auth.register(registrationInput)).resolves.toEqual(registrationResult);
    });

    it("rejects invalid email format", async () => {
      const caller = createCaller();
      await expect(
        caller.auth.register({ ...registrationInput, email: "not-an-email" }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("rejects empty password", async () => {
      const caller = createCaller();
      await expect(caller.auth.register({ ...registrationInput, password: "" })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    it("applies authHeavy rate limiting", async () => {
      const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
      vi.mocked(registerAccount).mockResolvedValue(registrationResult);
      const caller = createCaller(null);
      await assertProcedureRateLimited(
        vi.mocked(checkRateLimit),
        () => caller.auth.register(registrationInput),
        "authHeavy",
      );
    });
  });

  // ── login ─────────────────────────────────────────────────────────

  describe("auth.login", () => {
    const loginInput = { email: "test@example.com", password: "SuperSecret123!" };

    const loginResult = {
      sessionToken: "tok_xyz",
      accountId: MOCK_AUTH.accountId,
      systemId: MOCK_SYSTEM_ID,
      accountType: "system" as const,
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
        sessions: [{ id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: null }],
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
        caller.auth.session.revoke({ sessionId: "not-valid" as SessionId }),
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
