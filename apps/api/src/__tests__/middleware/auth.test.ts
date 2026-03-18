import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authMiddleware } from "../../middleware/auth.js";
import { errorHandler } from "../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../middleware/request-id.js";

import type { AuthContext, AuthEnv } from "../../lib/auth-context.js";
import type { ValidateSessionResult } from "../../lib/session-auth.js";
import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

const mockValidateSession = vi.fn<() => Promise<ValidateSessionResult>>();
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

vi.mock("../../lib/db.js", () => ({
  getDb: (): unknown => mockGetDb(),
}));

vi.mock("@pluralscape/db/pg", () => ({
  sessions: { id: "sessions.id" },
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
  authOverrides: Partial<AuthContext> = {},
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
      accountId: "acct_xyz" as AuthContext["accountId"],
      systemId: "sys_001" as AuthContext["systemId"],
      sessionId: "sess_00000000-0000-0000-0000-000000000001" as AuthContext["sessionId"],
      accountType: "system",
      ownedSystemIds: new Set(["sys_001" as AuthContext["systemId"] & string]),
      ...authOverrides,
    },
    session: session as ValidateSessionResult extends { ok: true; session: infer S } ? S : never,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("authMiddleware", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockValidateSession.mockReset();
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
    expect(body.error.message).toBe("Invalid or revoked session");
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
    expect(body.error.message).toBe("Session expired");
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

    // Wait for the microtask to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to update session lastActive",
      expect.objectContaining({ error: "DB write error" }),
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
});
