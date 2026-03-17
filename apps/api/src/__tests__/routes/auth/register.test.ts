import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/auth.service.js", () => ({
  registerAccount: vi.fn(),
  extractIpAddress: vi.fn().mockReturnValue(null),
  extractPlatform: vi.fn().mockReturnValue("web"),
  extractUserAgent: vi.fn().mockReturnValue(null),
  ValidationError: class ValidationError extends Error {
    override readonly name = "ValidationError" as const;
  },
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: unknown, next: () => Promise<void>) => {
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { registerAccount, ValidationError } = await import("../../../services/auth.service.js");
const { registerRoute } = await import("../../../routes/auth/register.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/register", registerRoute);
  app.onError(errorHandler);
  return app;
}

async function postJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return await app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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
      sessionToken: string;
      recoveryKey: string;
      accountId: string;
      accountType: string;
    };
    expect(body.sessionToken).toBe("tok_abc");
    expect(body.recoveryKey).toBe("rk_abc");
    expect(body.accountId).toBe("acct_123");
    expect(body.accountType).toBe("system");
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

  it("returns 400 VALIDATION_ERROR when registerAccount throws ZodError", async () => {
    const zodError = new Error("Validation failed");
    Object.defineProperty(zodError, "name", { value: "ZodError" });

    vi.mocked(registerAccount).mockRejectedValueOnce(zodError);

    const app = createApp();
    const res = await postJSON(app, "/register", VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid registration input");
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
});
