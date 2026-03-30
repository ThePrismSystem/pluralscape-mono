import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../lib/request-meta.js", () => ({
  extractPlatform: vi.fn().mockReturnValue("web"),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../services/auth.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/auth.service.js")>();
  return {
    loginAccount: vi.fn(),
    LoginThrottledError: actual.LoginThrottledError,
  };
});

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { loginAccount } = await import("../../../services/auth.service.js");
const { loginRoute } = await import("../../../routes/auth/login.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/login", loginRoute);

const VALID_CREDENTIALS = {
  email: "test@example.com",
  password: "strongpassword123",
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /login", () => {
  beforeEach(() => {
    vi.mocked(loginAccount).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with session data on successful login", async () => {
    vi.mocked(loginAccount).mockResolvedValueOnce({
      sessionToken: "tok_login",
      accountId: "acct_456",
      systemId: "sys_789",
      accountType: "system",
    });

    const app = createApp();
    const res = await postJSON(app, "/login", VALID_CREDENTIALS);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { sessionToken: string; accountId: string; systemId: string; accountType: string };
    };
    expect(body.data.sessionToken).toBe("tok_login");
    expect(body.data.accountId).toBe("acct_456");
    expect(body.data.systemId).toBe("sys_789");
    expect(body.data.accountType).toBe("system");
    // Login is unauthenticated — createAuditWriter should be called without auth
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything());
  });

  it("returns 401 UNAUTHENTICATED when loginAccount returns null", async () => {
    vi.mocked(loginAccount).mockResolvedValueOnce(null);

    const app = createApp();
    const res = await postJSON(app, "/login", VALID_CREDENTIALS);

    expect(res.status).toBe(401);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(body.error.message).toBe("Invalid email or password");
  });

  it("returns 400 VALIDATION_ERROR on ZodError (via global handler)", async () => {
    const zodError = new Error("Validation failed");
    Object.defineProperty(zodError, "name", { value: "ZodError" });
    // Suppress global error handler console.warn in test output
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.mocked(loginAccount).mockRejectedValueOnce(zodError);

    const app = createApp();
    const res = await postJSON(app, "/login", VALID_CREDENTIALS);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws ApiHttpError as-is", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(loginAccount).mockRejectedValueOnce(
      new ApiHttpError(429, "RATE_LIMITED", "Too many attempts"),
    );

    const app = createApp();
    const res = await postJSON(app, "/login", VALID_CREDENTIALS);

    expect(res.status).toBe(429);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid JSON body");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(loginAccount).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, "/login", VALID_CREDENTIALS);

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns 429 LOGIN_THROTTLED with fixed Retry-After when account is throttled", async () => {
    const { LoginThrottledError } = await import("../../../services/auth.service.js");
    const futureTime = Date.now() + 60_000;
    vi.mocked(loginAccount).mockRejectedValueOnce(new LoginThrottledError(futureTime));

    const app = createApp();
    const res = await postJSON(app, "/login", VALID_CREDENTIALS);

    expect(res.status).toBe(429);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("LOGIN_THROTTLED");
    expect(body.error.message).toBe("Too many failed login attempts");
    // Fixed Retry-After: always the full window duration (900s = 15 min)
    expect(res.headers.get("Retry-After")).toBe("900");
  });

  describe("Cache-Control", () => {
    it("sets Cache-Control: no-store on successful login", async () => {
      vi.mocked(loginAccount).mockResolvedValueOnce({
        sessionToken: "tok_cc",
        accountId: "acct_cc",
        systemId: "sys_cc",
        accountType: "system",
      });

      const app = createApp();
      const res = await postJSON(app, "/login", VALID_CREDENTIALS);

      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });

    it("sets Cache-Control: no-store on throttled response", async () => {
      const { LoginThrottledError } = await import("../../../services/auth.service.js");
      vi.mocked(loginAccount).mockRejectedValueOnce(new LoginThrottledError(Date.now() + 60_000));

      const app = createApp();
      const res = await postJSON(app, "/login", VALID_CREDENTIALS);

      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
  });
});
