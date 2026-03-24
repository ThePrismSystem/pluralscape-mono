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
  updateAccountSettings: vi.fn(),
  ConcurrencyError: class ConcurrencyError extends Error {
    override readonly name = "ConcurrencyError" as const;
  },
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createAuditWriter } = await import("../../../lib/audit-writer.js");
const { updateAccountSettings, ConcurrencyError } =
  await import("../../../services/account.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /account/settings", () => {
  beforeEach(() => {
    vi.mocked(updateAccountSettings).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated settings on success", async () => {
    vi.mocked(updateAccountSettings).mockResolvedValueOnce({
      ok: true,
      auditLogIpTracking: true,
      version: 2,
    });

    const app = createApp();
    const res = await app.request("/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditLogIpTracking: true, version: 1 }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      auditLogIpTracking: boolean;
      version: number;
    };
    expect(body.ok).toBe(true);
    expect(body.auditLogIpTracking).toBe(true);
    expect(body.version).toBe(2);
  });

  it("returns 409 on ConcurrencyError", async () => {
    vi.mocked(updateAccountSettings).mockRejectedValueOnce(
      new ConcurrencyError("Account was modified concurrently"),
    );

    const app = createApp();
    const res = await app.request("/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditLogIpTracking: true, version: 1 }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 400 on validation error", async () => {
    const zodError = new Error("Validation failed");
    zodError.name = "ZodError";
    vi.mocked(updateAccountSettings).mockRejectedValueOnce(zodError);

    const app = createApp();
    const res = await app.request("/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditLogIpTracking: "yes", version: 1 }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(updateAccountSettings).mockRejectedValueOnce(new Error("Unexpected DB failure"));

    const app = createApp();
    const res = await app.request("/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditLogIpTracking: true, version: 1 }),
    });

    expect(res.status).toBe(500);
  });

  it("passes account ID and body to service", async () => {
    vi.mocked(updateAccountSettings).mockResolvedValueOnce({
      ok: true,
      auditLogIpTracking: false,
      version: 2,
    });

    const app = createApp();
    await app.request("/account/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditLogIpTracking: false, version: 1 }),
    });

    expect(vi.mocked(updateAccountSettings)).toHaveBeenCalledWith(
      {},
      "acct_test",
      { auditLogIpTracking: false, version: 1 },
      expect.any(Function),
    );
    expect(vi.mocked(createAuditWriter)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: "acct_test" }),
    );
  });
});
