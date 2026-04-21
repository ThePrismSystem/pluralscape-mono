import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

vi.mock("../../../services/group/queries.js", () => ({
  getGroupTree: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
const { getGroupTree } = await import("../../../services/group/queries.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const TREE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/tree";

describe("GET /systems/:id/groups/tree", () => {
  beforeEach(() => {
    vi.mocked(getGroupTree).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with tree", async () => {
    vi.mocked(getGroupTree).mockResolvedValueOnce([]);

    const app = createApp();
    const res = await app.request(TREE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toEqual([]);
  });

  it("applies the readHeavy rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readHeavy");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(getGroupTree).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(TREE_URL);

    expect(res.status).toBe(500);
  });
});
