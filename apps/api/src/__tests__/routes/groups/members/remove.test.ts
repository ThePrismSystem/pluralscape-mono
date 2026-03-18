import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../../middleware/request-id.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

vi.mock("../../../../services/group-membership.service.js", () => ({
  removeMember: vi.fn(),
}));
vi.mock("../../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("../../../../lib/db.js", () => ({ getDb: vi.fn().mockResolvedValue({}) }));
vi.mock("../../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

vi.mock("../../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

const { removeMember } = await import("../../../../services/group-membership.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const REMOVE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000/members/mem_770e8400-e29b-41d4-a716-446655440000";

describe("DELETE /systems/:id/groups/:groupId/members/:memberId", () => {
  beforeEach(() => {
    vi.mocked(removeMember).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(removeMember).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(REMOVE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when membership not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(removeMember).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Group membership not found"),
    );

    const app = createApp();
    const res = await app.request(REMOVE_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
