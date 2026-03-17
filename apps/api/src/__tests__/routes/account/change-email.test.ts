import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/account.service.js", () => ({
  getAccountInfo: vi.fn(),
  changeEmail: vi.fn(),
  ConcurrencyError: class ConcurrencyError extends Error {
    override readonly name = "ConcurrencyError" as const;
  },
}));

vi.mock("../../../services/auth.service.js", () => ({
  ValidationError: class ValidationError extends Error {
    override readonly name = "ValidationError" as const;
  },
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../lib/request-meta.js", () => ({
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: null, userAgent: null }),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: unknown, next: () => Promise<void>) => {
      await next();
    }),
}));

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(
      () =>
        async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
          c.set("auth", {
            accountId: "acct_test",
            sessionId: "sess_current",
            systemId: null,
            accountType: "system",
          });
          await next();
        },
    ),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { changeEmail, ConcurrencyError } = await import("../../../services/account.service.js");
const { ValidationError } = await import("../../../services/auth.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/account", accountRoutes);
  app.onError(errorHandler);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /account/email", () => {
  beforeEach(() => {
    vi.mocked(changeEmail).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok on successful email change", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({ ok: true });

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "password123" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("returns 400 on ValidationError", async () => {
    vi.mocked(changeEmail).mockRejectedValueOnce(new ValidationError("Incorrect password"));

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "wrong" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 on email change failed (duplicate)", async () => {
    vi.mocked(changeEmail).mockRejectedValueOnce(new ValidationError("Email change failed"));

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "taken@example.com", currentPassword: "password123" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 409 on ConcurrencyError", async () => {
    vi.mocked(changeEmail).mockRejectedValueOnce(
      new ConcurrencyError("Account was modified concurrently"),
    );

    const app = createApp();
    const res = await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "password123" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("passes request body to changeEmail service", async () => {
    vi.mocked(changeEmail).mockResolvedValueOnce({ ok: true });

    const app = createApp();
    await app.request("/account/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", currentPassword: "password123" }),
    });

    expect(vi.mocked(changeEmail)).toHaveBeenCalledWith(
      {},
      "acct_test",
      { email: "new@example.com", currentPassword: "password123" },
      { ipAddress: null, userAgent: null },
    );
  });
});
