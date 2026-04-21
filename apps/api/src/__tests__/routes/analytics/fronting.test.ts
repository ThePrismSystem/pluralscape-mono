import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/analytics/fronting.js", () => ({
  computeFrontingBreakdown: vi.fn(),
}));

vi.mock("../../../services/analytics-query.service.js", () => ({
  parseAnalyticsQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { computeFrontingBreakdown } = await import("../../../services/analytics/fronting.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/analytics/fronting`;

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/analytics/fronting", () => {
  beforeEach(() => {
    vi.mocked(computeFrontingBreakdown).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with breakdown", async () => {
    vi.mocked(computeFrontingBreakdown).mockResolvedValueOnce({ entries: [] } as never);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { entries: unknown[] } };
    expect(body.data.entries).toEqual([]);
  });

  it("passes systemId and parsed query to service", async () => {
    vi.mocked(computeFrontingBreakdown).mockResolvedValueOnce({ entries: [] } as never);

    await createApp().request(BASE_URL);

    expect(vi.mocked(computeFrontingBreakdown)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/analytics/fronting`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
