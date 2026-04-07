import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

vi.mock("../../../../services/group-membership.service.js", () => ({
  listGroupMembers: vi.fn(),
}));
vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
const { listGroupMembers } = await import("../../../../services/group-membership.service.js");
const { createCategoryRateLimiter } = await import("../../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const MEMBERS_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000/members";
const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false, totalCount: null };

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
    expect(body.data).toEqual([]);
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listGroupMembers).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(MEMBERS_URL);

    expect(res.status).toBe(500);
  });
});
