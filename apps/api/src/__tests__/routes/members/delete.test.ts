import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteApp, MOCK_AUTH } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/member.service.js", () => ({
  deleteMember: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
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

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

const { deleteMember } = await import("../../../services/member.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const MEMBER_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/members/mem_660e8400-e29b-41d4-a716-446655440000";

describe("DELETE /systems/:id/members/:memberId", () => {
  beforeEach(() => {
    vi.mocked(deleteMember).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteMember).mockResolvedValueOnce(undefined);

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(MEMBER_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when member not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteMember).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Member not found"),
    );

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(MEMBER_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when member has dependents", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteMember).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Member has 2 fronting log(s)."),
    );

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(MEMBER_URL, { method: "DELETE" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(deleteMember).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createRouteApp("/systems", systemRoutes);
    const res = await app.request(MEMBER_URL, { method: "DELETE" });

    expect(res.status).toBe(500);
  });
});
