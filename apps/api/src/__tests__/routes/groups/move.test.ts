import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

vi.mock("../../../services/group.service.js", () => ({
  moveGroup: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));
vi.mock("../../../lib/db.js", () => ({ getDb: vi.fn().mockResolvedValue({}) }));
vi.mock("../../../middleware/rate-limit.js", () => ({
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

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

const { moveGroup } = await import("../../../services/group.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const MOVE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000/move";

describe("POST /systems/:id/groups/:groupId/move", () => {
  beforeEach(() => {
    vi.mocked(moveGroup).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with moved group", async () => {
    vi.mocked(moveGroup).mockResolvedValueOnce({
      id: "grp_660e8400-e29b-41d4-a716-446655440000" as never,
      systemId: MOCK_AUTH.systemId as never,
      parentGroupId: null,
      sortOrder: 0,
      encryptedData: "dGVzdA==",
      version: 2,
      createdAt: 1000 as never,
      updatedAt: 2000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    const res = await app.request(MOVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetParentGroupId: null, version: 1 }),
    });

    expect(res.status).toBe(200);
  });

  it("returns 409 on circular reference", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(moveGroup).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Circular reference detected"),
    );

    const app = createApp();
    const res = await app.request(MOVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetParentGroupId: "grp_child", version: 1 }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });
});
