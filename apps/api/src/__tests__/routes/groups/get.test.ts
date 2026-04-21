import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/group/queries.js", () => ({
  getGroup: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
const { getGroup } = await import("../../../services/group/queries.js");
const { createCategoryRateLimiter } = await import("../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const GROUP_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/grp_660e8400-e29b-41d4-a716-446655440000";

describe("GET /systems/:id/groups/:groupId", () => {
  beforeEach(() => {
    vi.mocked(getGroup).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with group", async () => {
    vi.mocked(getGroup).mockResolvedValueOnce({
      id: "grp_660e8400-e29b-41d4-a716-446655440000" as never,
      systemId: MOCK_AUTH.systemId as never,
      parentGroupId: null,
      sortOrder: 0,
      encryptedData: "dGVzdA==",
      version: 1,
      createdAt: 1000 as never,
      updatedAt: 1000 as never,
      archived: false,
      archivedAt: null,
    });

    const app = createApp();
    const res = await app.request(GROUP_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe("grp_660e8400-e29b-41d4-a716-446655440000");
  });

  it("returns 404 when group not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getGroup).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Group not found"),
    );

    const app = createApp();
    const res = await app.request(GROUP_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid group ID format", async () => {
    const app = createApp();
    const res = await app.request(
      "/systems/sys_550e8400-e29b-41d4-a716-446655440000/groups/not-valid",
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(getGroup).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(GROUP_URL);

    expect(res.status).toBe(500);
  });
});
