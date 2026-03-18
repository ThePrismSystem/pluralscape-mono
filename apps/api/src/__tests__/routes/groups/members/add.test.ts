import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../../middleware/request-id.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

vi.mock("../../../../services/group-membership.service.js", () => ({
  addMember: vi.fn(),
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
  ownedSystemIds: new Set([
    "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"] & string,
  ]),
};

vi.mock("../../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

const { addMember } = await import("../../../../services/group-membership.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const MEMBERS_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000/members";

describe("POST /systems/:id/groups/:groupId/members", () => {
  beforeEach(() => {
    vi.mocked(addMember).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new membership", async () => {
    vi.mocked(addMember).mockResolvedValueOnce({
      groupId: "grp_660e8400-e29b-41d4-a716-446655440000" as never,
      memberId: "mem_abc" as never,
      systemId: MOCK_AUTH.systemId as never,
      createdAt: 1000 as never,
    });

    const app = createApp();
    const res = await app.request(MEMBERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "mem_abc" }),
    });

    expect(res.status).toBe(201);
  });

  it("returns 409 when already a member", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(addMember).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Already a member of this group"),
    );

    const app = createApp();
    const res = await app.request(MEMBERS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "mem_abc" }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });
});
