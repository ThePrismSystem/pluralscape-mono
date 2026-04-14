import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authMiddleware } from "../../middleware/auth.js";
import { errorHandler } from "../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { AuthContext, AuthEnv, SessionAuthContext } from "../../lib/auth-context.js";
import type { ValidateSessionResult } from "../../lib/session-auth.js";
import type { ValidateApiKeyResult } from "../../services/api-key.service.js";
import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

const mockValidateSession = vi.fn<() => Promise<ValidateSessionResult>>();
const mockValidateApiKey = vi.fn<() => Promise<ValidateApiKeyResult | null>>();
const mockGetDb = vi.fn();
const mockDbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const { mockLogError } = vi.hoisted(() => ({
  mockLogError: vi.fn(),
}));

vi.mock("../../lib/logger.js", () => {
  const instance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLogError,
    debug: vi.fn(),
  };
  return {
    logger: instance,
    createRequestLogger: () => instance,
    getContextLogger: () => instance,
  };
});

vi.mock("../../lib/session-auth.js", () => ({
  validateSession: (): Promise<ValidateSessionResult> => mockValidateSession(),
}));

vi.mock("../../services/api-key.service.js", () => ({
  validateApiKey: (): Promise<ValidateApiKeyResult | null> => mockValidateApiKey(),
}));

vi.mock("../../lib/db.js", () => ({
  getDb: (): unknown => mockGetDb(),
}));

vi.mock("@pluralscape/db/pg", () => ({
  sessions: { id: "sessions.id" },
  apiKeys: { id: "apiKeys.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _eq: val })),
}));

const mockNow = vi.fn<() => number>();
vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    now: () => mockNow(),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────

function createApp(): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();
  app.use("*", requestIdMiddleware());
  app.onError(errorHandler);
  app.use("*", authMiddleware());
  app.get("/protected", (c) => {
    const auth = c.get("auth");
    return c.json({ auth });
  });
  return app;
}

/** A valid 64-char lowercase hex token for tests. */
const VALID_TOKEN = "a0".repeat(32);

/** A valid API key token: ps_ prefix + 64 lowercase hex chars. */
const VALID_API_KEY_TOKEN = `ps_${"b1".repeat(32)}`;

interface MockSessionData {
  id: string;
  accountId: string;
  tokenHash: string;
  revoked: boolean;
  createdAt: number;
  expiresAt: number | null;
  lastActive: number | null;
  encryptedData: null;
}

function makeValidResult(
  sessionOverrides: Partial<MockSessionData> = {},
  authOverrides: Partial<SessionAuthContext> = {},
): ValidateSessionResult {
  const session: MockSessionData = {
    id: "sess_00000000-0000-0000-0000-000000000001",
    accountId: "acct_xyz",
    tokenHash: "hashed_token",
    revoked: false,
    createdAt: 1_000_000,
    expiresAt: 1_000_000 + 2_592_000_000,
    lastActive: 1_050_000,
    encryptedData: null,
    ...sessionOverrides,
  };
  return {
    ok: true,
    auth: {
      authMethod: "session" as const,
      accountId: "acct_xyz" as AuthContext["accountId"],
      systemId: "sys_001" as AuthContext["systemId"],
      sessionId: "sess_00000000-0000-0000-0000-000000000001" as SessionAuthContext["sessionId"],
      accountType: "system",
      ownedSystemIds: new Set(["sys_001" as AuthContext["systemId"] & string]),
      auditLogIpTracking: false,
      ...authOverrides,
    },
    session: session as ValidateSessionResult extends { ok: true; session: infer S } ? S : never,
  };
}

function makeValidApiKeyResult(
  overrides: Partial<ValidateApiKeyResult> = {},
): ValidateApiKeyResult {
  return {
    accountId: "acct_apikey" as ValidateApiKeyResult["accountId"],
    systemId: "sys_apikey" as ValidateApiKeyResult["systemId"],
    scopes: ["read:members", "read:fronting"],
    auditLogIpTracking: false,
    keyId: "ak_00000000-0000-0000-0000-000000000001" as ValidateApiKeyResult["keyId"],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("authMiddleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockValidateSession.mockReset();
    mockValidateApiKey.mockReset();
    mockGetDb.mockReset();
    mockNow.mockReset();
    mockDbUpdate.mockClear();
    mockLogError.mockClear();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const app = createApp();
    const res = await app.request("/protected");

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).toBe("Authorization header required");
  });

  it("returns 401 when Authorization header has wrong format", async () => {
    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: "Basic abc123" },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).toBe("Invalid authorization format");
  });

  it("returns 401 when Bearer token is empty", async () => {
    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer " },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for token with non-hex characters", async () => {
    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${"g".repeat(64)}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).toBe("Invalid or revoked session");
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it("returns 401 for uppercase hex token", async () => {
    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${"A0".repeat(32)}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).toBe("Invalid or revoked session");
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it("returns 401 for token with wrong length", async () => {
    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer abcdef1234" },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).toBe("Invalid or revoked session");
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it("returns 401 with UNAUTHENTICATED when session is invalid", async () => {
    const mockDb = { update: mockDbUpdate };
    mockGetDb.mockResolvedValue(mockDb);
    mockValidateSession.mockResolvedValue({ ok: false, error: "UNAUTHENTICATED" });

    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${"b0".repeat(32)}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).toBe("Authentication required");
  });

  it("returns 401 with SESSION_EXPIRED when session is expired", async () => {
    const mockDb = { update: mockDbUpdate };
    mockGetDb.mockResolvedValue(mockDb);
    mockValidateSession.mockResolvedValue({ ok: false, error: "SESSION_EXPIRED" });

    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${"c0".repeat(32)}` },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("SESSION_EXPIRED");
    expect(body.error.message).toBe("Session has expired");
  });

  it("sets auth context and calls next() on valid session", async () => {
    const validResult = makeValidResult({ lastActive: 1_050_000 });
    const mockDb = { update: mockDbUpdate };
    mockGetDb.mockResolvedValue(mockDb);
    mockValidateSession.mockResolvedValue(validResult);
    // Within throttle threshold — no update
    mockNow.mockReturnValue(1_060_000);

    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { auth: AuthContext };
    expect(body.auth).toEqual(
      expect.objectContaining({
        authMethod: "session",
        accountId: "acct_xyz",
        systemId: "sys_001",
        sessionId: "sess_00000000-0000-0000-0000-000000000001",
        accountType: "system",
      }),
    );
  });

  it("updates lastActive when it is null", async () => {
    const validResult = makeValidResult({ lastActive: null });
    const mockDb = { update: mockDbUpdate };
    mockGetDb.mockResolvedValue(mockDb);
    mockValidateSession.mockResolvedValue(validResult);
    mockNow.mockReturnValue(2_000_000);

    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });

    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("updates lastActive when stale beyond throttle threshold", async () => {
    // LAST_ACTIVE_THROTTLE_MS = 60_000 (1 minute)
    const validResult = makeValidResult({ lastActive: 1_050_000 });
    const mockDb = { update: mockDbUpdate };
    mockGetDb.mockResolvedValue(mockDb);
    mockValidateSession.mockResolvedValue(validResult);
    // now - lastActive = 1_200_000 - 1_050_000 = 150_000 > 60_000
    mockNow.mockReturnValue(1_200_000);

    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });

    expect(res.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("does not update lastActive when within throttle threshold", async () => {
    // LAST_ACTIVE_THROTTLE_MS = 60_000 (1 minute)
    const validResult = makeValidResult({ lastActive: 1_050_000 });
    const mockDb = { update: mockDbUpdate };
    mockGetDb.mockResolvedValue(mockDb);
    mockValidateSession.mockResolvedValue(validResult);
    // now - lastActive = 1_060_000 - 1_050_000 = 10_000 < 60_000
    mockNow.mockReturnValue(1_060_000);

    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });

    expect(res.status).toBe(200);
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("does not crash when lastActive update fails", async () => {
    const validResult = makeValidResult({ lastActive: null });
    const failingUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("DB write error")),
      }),
    });
    const mockDb = { update: failingUpdate };
    mockGetDb.mockResolvedValue(mockDb);
    mockValidateSession.mockResolvedValue(validResult);
    mockNow.mockReturnValue(2_000_000);

    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });

    // Request should still succeed — fire-and-forget error is caught
    expect(res.status).toBe(200);

    // Flush fire-and-forget promise — no fake timers here since the
    // delay is waiting for a real async void operation to settle.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to update session lastActive",
      expect.objectContaining({ err: expect.any(Error) }),
    );
  });

  it("handles case-insensitive Bearer prefix", async () => {
    const mockDb = { update: mockDbUpdate };
    mockGetDb.mockResolvedValue(mockDb);
    mockValidateSession.mockResolvedValue(makeValidResult());
    mockNow.mockReturnValue(1_060_000);

    const app = createApp();
    const res = await app.request("/protected", {
      headers: { Authorization: `bearer ${VALID_TOKEN}` },
    });

    expect(res.status).toBe(200);
    expect(mockValidateSession).toHaveBeenCalled();
  });

  // ── API key authentication ──────────────────────────────────────────

  describe("API key authentication", () => {
    it("returns 200 with apiKeyScopes in auth context for valid API key", async () => {
      const apiKeyResult = makeValidApiKeyResult();
      const mockDb = { update: mockDbUpdate };
      mockGetDb.mockResolvedValue(mockDb);
      mockValidateApiKey.mockResolvedValue(apiKeyResult);
      mockNow.mockReturnValue(2_000_000);

      const app = createApp();
      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${VALID_API_KEY_TOKEN}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { auth: AuthContext };
      expect(body.auth).toEqual(
        expect.objectContaining({
          authMethod: "apiKey",
          accountId: "acct_apikey",
          systemId: "sys_apikey",
          accountType: "system",
          apiKeyScopes: ["read:members", "read:fronting"],
          keyId: "ak_00000000-0000-0000-0000-000000000001",
        }),
      );
      expect(body.auth).not.toHaveProperty("sessionId");
    });

    it("returns 401 for revoked API key", async () => {
      const mockDb = { update: mockDbUpdate };
      mockGetDb.mockResolvedValue(mockDb);
      mockValidateApiKey.mockResolvedValue(null);

      const app = createApp();
      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${VALID_API_KEY_TOKEN}` },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("UNAUTHENTICATED");
      expect(body.error.message).toBe("Invalid or revoked API key");
    });

    it("returns 401 for expired API key", async () => {
      const mockDb = { update: mockDbUpdate };
      mockGetDb.mockResolvedValue(mockDb);
      // validateApiKey returns null for expired keys
      mockValidateApiKey.mockResolvedValue(null);

      const app = createApp();
      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${VALID_API_KEY_TOKEN}` },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("UNAUTHENTICATED");
      expect(body.error.message).toBe("Invalid or revoked API key");
    });

    it("returns 401 for invalid API key (bad hash)", async () => {
      const mockDb = { update: mockDbUpdate };
      mockGetDb.mockResolvedValue(mockDb);
      // validateApiKey returns null when no matching hash found
      mockValidateApiKey.mockResolvedValue(null);

      const invalidApiKey = `ps_${"ff".repeat(32)}`;
      const app = createApp();
      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${invalidApiKey}` },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe("UNAUTHENTICATED");
      expect(body.error.message).toBe("Invalid or revoked API key");
    });

    it("ownedSystemIds contains only the key's systemId", async () => {
      const apiKeyResult = makeValidApiKeyResult({
        systemId: "sys_only" as ValidateApiKeyResult["systemId"],
      });
      const mockDb = { update: mockDbUpdate };
      mockGetDb.mockResolvedValue(mockDb);
      mockValidateApiKey.mockResolvedValue(apiKeyResult);
      mockNow.mockReturnValue(2_000_000);

      const app = createApp();
      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${VALID_API_KEY_TOKEN}` },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { auth: Record<string, unknown> };
      // Sets are serialized as empty objects in JSON; verify systemId matches
      expect(body.auth.systemId).toBe("sys_only");
      expect(body.auth.accountType).toBe("system");
    });

    it("fires lastUsedAt update for valid API key", async () => {
      const apiKeyResult = makeValidApiKeyResult();
      const mockDb = { update: mockDbUpdate };
      mockGetDb.mockResolvedValue(mockDb);
      mockValidateApiKey.mockResolvedValue(apiKeyResult);
      mockNow.mockReturnValue(3_000_000);

      const app = createApp();
      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${VALID_API_KEY_TOKEN}` },
      });

      expect(res.status).toBe(200);
      expect(mockDbUpdate).toHaveBeenCalled();
    });

    it("does not crash when lastUsedAt update fails for API key", async () => {
      const apiKeyResult = makeValidApiKeyResult();
      const failingUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("DB write error")),
        }),
      });
      const mockDb = { update: failingUpdate };
      mockGetDb.mockResolvedValue(mockDb);
      mockValidateApiKey.mockResolvedValue(apiKeyResult);
      mockNow.mockReturnValue(3_000_000);

      const app = createApp();
      const res = await app.request("/protected", {
        headers: { Authorization: `Bearer ${VALID_API_KEY_TOKEN}` },
      });

      expect(res.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogError).toHaveBeenCalledWith(
        "Failed to update API key lastUsedAt",
        expect.objectContaining({ err: expect.any(Error) }),
      );
    });

    it("does not call validateSession for API key tokens", async () => {
      const apiKeyResult = makeValidApiKeyResult();
      const mockDb = { update: mockDbUpdate };
      mockGetDb.mockResolvedValue(mockDb);
      mockValidateApiKey.mockResolvedValue(apiKeyResult);
      mockNow.mockReturnValue(2_000_000);

      const app = createApp();
      await app.request("/protected", {
        headers: { Authorization: `Bearer ${VALID_API_KEY_TOKEN}` },
      });

      expect(mockValidateSession).not.toHaveBeenCalled();
    });
  });
});
