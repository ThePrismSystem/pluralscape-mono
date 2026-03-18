import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/group.service.js", () => ({
  listGroups: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

const { listGroups } = await import("../../../services/group.service.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

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

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listGroups).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(SYS_URL);

    expect(res.status).toBe(500);
  });
});
