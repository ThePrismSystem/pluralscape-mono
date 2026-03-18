import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { Context } from "hono";


// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld-region.service.js", () => ({
  listRegions: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

vi.mock("../../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { listRegions } = await import("../../../../services/innerworld-region.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/regions";

const MOCK_REGION = {
  id: "iwr_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  parentRegionId: null,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const EMPTY_PAGE = { items: [], nextCursor: null, hasMore: false, totalCount: null };

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id/innerworld/regions", () => {
  beforeEach(() => {
    vi.mocked(listRegions).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated list", async () => {
    const page = { items: [MOCK_REGION], nextCursor: null, hasMore: false, totalCount: 1 };
    vi.mocked(listRegions).mockResolvedValueOnce(page);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof page;
    expect(body.items).toHaveLength(1);
    expect((body.items[0] as Record<string, unknown>).id).toBe(
      "iwr_660e8400-e29b-41d4-a716-446655440000",
    );
    expect(body.hasMore).toBe(false);
    expect(body.totalCount).toBe(1);
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listRegions).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof EMPTY_PAGE;
    expect(body.items).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("respects query params (cursor, limit, includeArchived)", async () => {
    vi.mocked(listRegions).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request(`${BASE_URL}?cursor=abc&limit=5&includeArchived=true`);

    expect(res.status).toBe(200);
    expect(vi.mocked(listRegions)).toHaveBeenCalledOnce();
  });
});
