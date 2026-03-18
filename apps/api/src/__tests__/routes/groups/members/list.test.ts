import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../../middleware/request-id.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
import type { Context } from "hono";

vi.mock("../../../../services/group-membership.service.js", () => ({
  listGroupMembers: vi.fn(),
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

const { listGroupMembers } = await import("../../../../services/group-membership.service.js");
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
const EMPTY_PAGE = { items: [], nextCursor: null, hasMore: false, totalCount: null };

describe("GET /systems/:id/groups/:groupId/members", () => {
  beforeEach(() => {
    vi.mocked(listGroupMembers).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with member list", async () => {
    vi.mocked(listGroupMembers).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(MEMBERS_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.items).toEqual([]);
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listGroupMembers).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(MEMBERS_URL);

    expect(res.status).toBe(500);
  });
});
