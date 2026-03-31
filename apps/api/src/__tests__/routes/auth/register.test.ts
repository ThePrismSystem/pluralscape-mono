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
  registerAccount: vi.fn(),
  ValidationError: class ValidationError extends Error {
    override readonly name = "ValidationError" as const;
  },
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { registerAccount, ValidationError } = await import("../../../services/auth.service.js");
const { registerRoute } = await import("../../../routes/auth/register.js");
const { authRoutes } = await import("../../../routes/auth/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/register", registerRoute);
const createAuthApp = () => createRouteApp("/auth", authRoutes);

const VALID_BODY = {
  email: "test@example.com",
  password: "strongpassword123",
  recoveryKeyBackupConfirmed: true,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /register", () => {
  beforeEach(() => {
    vi.mocked(registerAccount).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with session data on successful registration", async () => {
    vi.mocked(registerAccount).mockResolvedValueOnce({
      sessionToken: "tok_abc",
      recoveryKey: "rk_abc",
      accountId: "acct_123",
      accountType: "system",
    });

    const app = createApp();
    const res = await postJSON(app, "/register", VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { sessionToken: string; recoveryKey: string; accountId: string; accountType: string };
    };
    expect(body.data.sessionToken).toBe("tok_abc");
    expect(body.data.recoveryKey).toBe("rk_abc");
    expect(body.data.accountId).toBe("acct_123");
    expect(body.data.accountType).toBe("system");
    // Register is unauthenticated — createAuditWriter should be called without auth
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(expect.anything());
  });

  it("returns 400 VALIDATION_ERROR when registerAccount throws ValidationError", async () => {
    vi.mocked(registerAccount).mockRejectedValueOnce(
      new ValidationError("Recovery key backup must be confirmed"),
    );

    const app = createApp();
    const res = await postJSON(app, "/register", VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Recovery key backup must be confirmed");
  });

  it("returns 400 VALIDATION_ERROR when registerAccount throws ZodError (via global handler)", async () => {
    const zodError = new Error("Validation failed");
    Object.defineProperty(zodError, "name", { value: "ZodError" });
    // Suppress global error handler console.warn in test output
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    vi.mocked(registerAccount).mockRejectedValueOnce(zodError);

    const app = createApp();
    const res = await postJSON(app, "/register", VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/register", {
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
    vi.mocked(registerAccount).mockRejectedValueOnce(new Error("Database connection failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, "/register", VALID_BODY);

    // errorHandler catches it as a 500
    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  describe("Cache-Control", () => {
    it("sets Cache-Control: no-store on successful registration", async () => {
      vi.mocked(registerAccount).mockResolvedValueOnce({
        sessionToken: "tok_cc",
        recoveryKey: "rk_cc",
        accountId: "acct_cc",
        accountType: "system",
      });

      const app = createAuthApp();
      const res = await postJSON(app, "/auth/register", VALID_BODY);

      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
  });
});
