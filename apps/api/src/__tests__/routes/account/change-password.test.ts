import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

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

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { changePassword, ConcurrencyError } = await import("../../../services/account.service.js");
const { ValidationError } = await import("../../../services/auth.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /account/password", () => {
  beforeEach(() => {
    vi.mocked(changePassword).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok with revokedSessionCount on success", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce({
      ok: true,
      revokedSessionCount: 3,
      sessionRevoked: true,
    });

    const app = createApp();
    const res = await app.request("/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "oldpass123", newPassword: "newpass123" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { ok: boolean; revokedSessionCount: number; sessionRevoked: boolean };
    };
    expect(body.data.ok).toBe(true);
    expect(body.data.revokedSessionCount).toBe(3);
    expect(body.data.sessionRevoked).toBe(true);
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

  it("passes account ID to service", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce({
      ok: true,
      revokedSessionCount: 0,
      sessionRevoked: false,
    });

    const app = createApp();
    await app.request("/account/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "oldpass123", newPassword: "newpass123" }),
    });

    expect(vi.mocked(changePassword)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      { currentPassword: "oldpass123", newPassword: "newpass123" },
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "acct_test001" }),
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
