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

vi.mock("../../../services/auth.service.js", () => ({
  loginAccount: vi.fn(),
}));

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
      sessionToken: string;
      accountId: string;
      systemId: string;
      accountType: string;
    };
    expect(body.sessionToken).toBe("tok_login");
    expect(body.accountId).toBe("acct_456");
    expect(body.systemId).toBe("sys_789");
    expect(body.accountType).toBe("system");
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

  it("returns 400 VALIDATION_ERROR on ZodError", async () => {
    const zodError = new Error("Validation failed");
    Object.defineProperty(zodError, "name", { value: "ZodError" });

    vi.mocked(loginAccount).mockRejectedValueOnce(zodError);

    const app = createApp();
    const res = await postJSON(app, "/login", VALID_CREDENTIALS);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid login input");
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
});
