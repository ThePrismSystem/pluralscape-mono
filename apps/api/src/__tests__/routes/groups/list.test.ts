import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/group.service.js", () => ({
  listGroups: vi.fn(),
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

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
  ownedSystemIds: new Set([
    "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"] & string,
  ]),
};

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

const { listGroups } = await import("../../../services/group.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const SYS_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups";
const EMPTY_PAGE = { items: [], nextCursor: null, hasMore: false, totalCount: null };

describe("GET /systems/:id/groups", () => {
  beforeEach(() => {
    vi.mocked(listGroups).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listGroups).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(SYS_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.items).toEqual([]);
  });

  it("forwards systemId, auth, cursor, and limit to service", async () => {
    vi.mocked(listGroups).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`${SYS_URL}?cursor=grp_abc&limit=10`);

    expect(vi.mocked(listGroups)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      MOCK_AUTH,
      "grp_abc",
      10,
    );
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listGroups).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(SYS_URL);

    expect(res.status).toBe(500);
  });
});
