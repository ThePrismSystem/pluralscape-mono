import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld-region/queries.js", () => ({
  getRegion: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getRegion } = await import("../../../../services/innerworld-region/queries.js");
const { createCategoryRateLimiter } = await import("../../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/regions";
const REGION_URL = `${BASE_URL}/iwr_660e8400-e29b-41d4-a716-446655440000`;

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

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id/innerworld/regions/:regionId", () => {
  beforeEach(() => {
    vi.mocked(getRegion).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with region", async () => {
    vi.mocked(getRegion).mockResolvedValueOnce(MOCK_REGION);

    const res = await createApp().request(REGION_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_REGION };
    expect(body.data.id).toBe("iwr_660e8400-e29b-41d4-a716-446655440000");
    expect(body.data.encryptedData).toBe("dGVzdA==");
    expect(body.data.archived).toBe(false);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(getRegion).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Region not found"),
    );

    const res = await createApp().request(REGION_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid regionId format", async () => {
    const res = await createApp().request(`${BASE_URL}/not-valid`);

    expect(res.status).toBe(400);
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });
});
