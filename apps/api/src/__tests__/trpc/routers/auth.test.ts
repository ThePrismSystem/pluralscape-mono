import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type { AccountId, SessionId, SystemId } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

const MOCK_ACCOUNT_ID = "acct_test001" as AccountId;
const MOCK_SESSION_ID = "sess_test001" as SessionId;
const MOCK_OTHER_SESSION_ID = "sess_test002" as SessionId;
const MOCK_SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;

const MOCK_AUTH: AuthContext = {
  accountId: MOCK_ACCOUNT_ID,
  systemId: MOCK_SYSTEM_ID,
  sessionId: MOCK_SESSION_ID,
  accountType: "system",
  ownedSystemIds: new Set([MOCK_SYSTEM_ID]),
  auditLogIpTracking: false,
};

const noopAuditWriter: AuditWriter = () => Promise.resolve();

function makeContext(auth: AuthContext | null): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  };
}

function makeCaller(auth: AuthContext | null = null) {
  const appRouter = router({ auth: authRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

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
      accountId: MOCK_ACCOUNT_ID,
      accountType: "system" as const,
    };

    it("calls registerAccount and defaults platform to 'web'", async () => {
      vi.mocked(registerAccount).mockResolvedValue(registrationResult);
      const caller = makeCaller();
      const result = await caller.auth.register(registrationInput);

      expect(vi.mocked(registerAccount)).toHaveBeenCalledOnce();
      expect(vi.mocked(registerAccount).mock.calls[0]?.[2]).toBe("web");
      expect(result).toEqual(registrationResult);
    });

    it("accepts explicit platform override", async () => {
      vi.mocked(registerAccount).mockResolvedValue(registrationResult);
      const caller = makeCaller();
      await caller.auth.register({ ...registrationInput, platform: "mobile" });

      expect(vi.mocked(registerAccount).mock.calls[0]?.[2]).toBe("mobile");
    });

    it("does not require authentication", async () => {
      vi.mocked(registerAccount).mockResolvedValue(registrationResult);
      const caller = makeCaller(null);
      await expect(caller.auth.register(registrationInput)).resolves.toEqual(registrationResult);
    });
  });

  // ── login ─────────────────────────────────────────────────────────

  describe("auth.login", () => {
    const loginInput = { email: "test@example.com", password: "SuperSecret123!" };

    const loginResult = {
      sessionToken: "tok_xyz",
      accountId: MOCK_ACCOUNT_ID,
      systemId: MOCK_SYSTEM_ID,
      accountType: "system" as const,
    };

    it("returns result when credentials are valid", async () => {
      vi.mocked(loginAccount).mockResolvedValue(loginResult);
      const caller = makeCaller();
      const result = await caller.auth.login(loginInput);
      expect(result).toEqual(loginResult);
    });

    it("throws UNAUTHORIZED when loginAccount returns null", async () => {
      vi.mocked(loginAccount).mockResolvedValue(null);
      const caller = makeCaller();
      await expect(caller.auth.login(loginInput)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws TOO_MANY_REQUESTS when LoginThrottledError is thrown", async () => {
      vi.mocked(loginAccount).mockRejectedValue(new LoginThrottledError(Date.now() + 60_000));
      const caller = makeCaller();
      await expect(caller.auth.login(loginInput)).rejects.toThrow(
        expect.objectContaining({ code: "TOO_MANY_REQUESTS" }),
      );
    });
  });

  // ── logout ────────────────────────────────────────────────────────

  describe("auth.logout", () => {
    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(caller.auth.logout()).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("calls logoutCurrentSession and returns success", async () => {
      vi.mocked(logoutCurrentSession).mockResolvedValue(undefined);
      const caller = makeCaller(MOCK_AUTH);
      const result = await caller.auth.logout();

      expect(result).toEqual({ success: true });
      expect(vi.mocked(logoutCurrentSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(logoutCurrentSession).mock.calls[0]?.[1]).toBe(MOCK_SESSION_ID);
      expect(vi.mocked(logoutCurrentSession).mock.calls[0]?.[2]).toBe(MOCK_ACCOUNT_ID);
    });
  });

  // ── listSessions ──────────────────────────────────────────────────

  describe("auth.listSessions", () => {
    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(caller.auth.listSessions({})).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("returns paginated sessions", async () => {
      const mockResult = {
        sessions: [{ id: "sess_1", createdAt: 1000, lastActive: 2000, expiresAt: null }],
        nextCursor: null,
      };
      vi.mocked(listSessions).mockResolvedValue(mockResult);
      const caller = makeCaller(MOCK_AUTH);
      const result = await caller.auth.listSessions({});
      expect(result).toEqual(mockResult);
    });

    it("passes cursor and limit", async () => {
      vi.mocked(listSessions).mockResolvedValue({ sessions: [], nextCursor: null });
      const caller = makeCaller(MOCK_AUTH);
      await caller.auth.listSessions({ cursor: "cur_abc", limit: 10 });

      expect(vi.mocked(listSessions).mock.calls[0]?.[2]).toBe("cur_abc");
      expect(vi.mocked(listSessions).mock.calls[0]?.[3]).toBe(10);
    });
  });

  // ── revokeSession ─────────────────────────────────────────────────

  describe("auth.revokeSession", () => {
    it("throws BAD_REQUEST when revoking the current session", async () => {
      const caller = makeCaller(MOCK_AUTH);
      await expect(caller.auth.revokeSession({ sessionId: MOCK_SESSION_ID })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    it("throws NOT_FOUND when revokeSession returns false", async () => {
      vi.mocked(revokeSession).mockResolvedValue(false);
      const caller = makeCaller(MOCK_AUTH);
      await expect(caller.auth.revokeSession({ sessionId: MOCK_OTHER_SESSION_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });

    it("returns success when session is revoked", async () => {
      vi.mocked(revokeSession).mockResolvedValue(true);
      const caller = makeCaller(MOCK_AUTH);
      const result = await caller.auth.revokeSession({ sessionId: MOCK_OTHER_SESSION_ID });
      expect(result).toEqual({ revoked: true });
    });
  });

  // ── revokeAllSessions ─────────────────────────────────────────────

  describe("auth.revokeAllSessions", () => {
    it("returns count of revoked sessions", async () => {
      vi.mocked(revokeAllSessions).mockResolvedValue(3);
      const caller = makeCaller(MOCK_AUTH);
      const result = await caller.auth.revokeAllSessions();
      expect(result).toEqual({ revoked: 3 });
    });

    it("passes current sessionId as exception", async () => {
      vi.mocked(revokeAllSessions).mockResolvedValue(0);
      const caller = makeCaller(MOCK_AUTH);
      await caller.auth.revokeAllSessions();

      expect(vi.mocked(revokeAllSessions).mock.calls[0]?.[2]).toBe(MOCK_SESSION_ID);
    });
  });
});
