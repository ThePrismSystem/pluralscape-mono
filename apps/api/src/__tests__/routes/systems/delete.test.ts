import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/system.service.js", () => ({
  archiveSystem: vi.fn(),
}));

vi.mock("../../../lib/request-meta.js", () => ({
  extractRequestMeta: vi.fn().mockReturnValue({ ipAddress: null, userAgent: null }),
  extractIpAddress: vi.fn().mockReturnValue(null),
  extractUserAgent: vi.fn().mockReturnValue(null),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_test" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { archiveSystem } = await import("../../../services/system.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:id", () => {
  beforeEach(() => {
    vi.mocked(archiveSystem).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with ok: true on success", async () => {
    vi.mocked(archiveSystem).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request("/systems/sys_abc", { method: "DELETE" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("forwards systemId, auth, and requestMeta to service", async () => {
    vi.mocked(archiveSystem).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request("/systems/sys_abc", { method: "DELETE" });

    expect(vi.mocked(archiveSystem)).toHaveBeenCalledWith(expect.anything(), "sys_abc", MOCK_AUTH, {
      ipAddress: null,
      userAgent: null,
    });
  });

  it("returns 404 when system not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveSystem).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "System not found"),
    );

    const app = createApp();
    const res = await app.request("/systems/sys_abc", { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when system has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveSystem).mockRejectedValueOnce(
      new ApiHttpError(
        409,
        "HAS_DEPENDENTS",
        "System has 3 active member(s). Delete all members before deleting the system.",
      ),
    );

    const app = createApp();
    const res = await app.request("/systems/sys_abc", { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("returns 409 when it is the last system", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveSystem).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Cannot delete the only system on the account"),
    );

    const app = createApp();
    const res = await app.request("/systems/sys_abc", { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.message).toBe("Cannot delete the only system on the account");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(archiveSystem).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request("/systems/sys_abc", { method: "DELETE" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
