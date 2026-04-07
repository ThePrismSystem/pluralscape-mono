import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/analytics.service.js", () => ({
  computeCoFrontingBreakdown: vi.fn(),
}));

vi.mock("../../../services/analytics-query.service.js", () => ({
  parseAnalyticsQuery: vi.fn().mockImplementation((q: Record<string, string>) => ({
    fromDate: q.fromDate ? Number(q.fromDate) : undefined,
    toDate: q.toDate ? Number(q.toDate) : undefined,
  })),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { computeCoFrontingBreakdown } = await import("../../../services/analytics.service.js");
const { parseAnalyticsQuery } = await import("../../../services/analytics-query.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/analytics/co-fronting`;

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/analytics/co-fronting", () => {
  beforeEach(() => {
    vi.mocked(computeCoFrontingBreakdown).mockReset();
    vi.mocked(parseAnalyticsQuery).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with breakdown", async () => {
    vi.mocked(computeCoFrontingBreakdown).mockResolvedValueOnce({ pairs: [] } as never);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { pairs: unknown[] } };
    expect(body.data.pairs).toEqual([]);
  });

  it("passes date range query to service", async () => {
    vi.mocked(computeCoFrontingBreakdown).mockResolvedValueOnce({ pairs: [] } as never);

    await createApp().request(`${BASE_URL}?fromDate=1000&toDate=2000`);

    expect(parseAnalyticsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ fromDate: "1000", toDate: "2000" }),
    );
    expect(vi.mocked(computeCoFrontingBreakdown)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      expect.any(Object),
      { fromDate: 1000, toDate: 2000 },
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/analytics/co-fronting`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
