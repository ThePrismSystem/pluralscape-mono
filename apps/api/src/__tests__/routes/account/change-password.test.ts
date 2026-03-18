import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/account.service.js", () => ({
  getAccountInfo: vi.fn(),
  changePassword: vi.fn(),
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

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
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
            ownedSystemIds: new Set(),
          });
          await next();
        },
    ),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { changePassword, ConcurrencyError } = await import("../../../services/account.service.js");
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

describe("PUT /account/password", () => {
  beforeEach(() => {
    vi.mocked(changePassword).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok with revokedSessionCount on success", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce({ ok: true, revokedSessionCount: 3 });

    const app = createApp();
    const res = await app.request("/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "oldpass123", newPassword: "newpass123" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; revokedSessionCount: number };
    expect(body.ok).toBe(true);
    expect(body.revokedSessionCount).toBe(3);
  });

  it("returns 400 on ValidationError", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(new ValidationError("Incorrect password"));

    const app = createApp();
    const res = await app.request("/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "wrong", newPassword: "newpass123" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("passes session ID and account ID to service", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce({ ok: true, revokedSessionCount: 0 });

    const app = createApp();
    await app.request("/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "oldpass123", newPassword: "newpass123" }),
    });

    expect(vi.mocked(changePassword)).toHaveBeenCalledWith(
      {},
      "acct_test",
      "sess_current",
      { currentPassword: "oldpass123", newPassword: "newpass123" },
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "acct_test" }),
    );
  });

  it("returns 409 on ConcurrencyError", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(
      new ConcurrencyError("Account was modified concurrently"),
    );

    const app = createApp();
    const res = await app.request("/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "oldpass123", newPassword: "newpass123" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 400 on short new password", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(
      new ValidationError("Password must be at least 8 characters"),
    );

    const app = createApp();
    const res = await app.request("/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "oldpass123", newPassword: "short" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("Password must be at least");
  });
});
