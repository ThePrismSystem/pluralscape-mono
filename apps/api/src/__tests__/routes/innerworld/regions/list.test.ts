import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toCursor } from "../../../../lib/pagination.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/innerworld/region/queries.js", () => ({
  listRegions: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { listRegions } = await import("../../../../services/innerworld/region/queries.js");
const { createCategoryRateLimiter } = await import("../../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/innerworld/regions";

const MOCK_REGION = {
  id: "iwr_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  parentRegionId: null,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false, totalCount: null };

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id/innerworld/regions", () => {
  beforeEach(() => {
    vi.mocked(listRegions).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated list", async () => {
    const page = { data: [MOCK_REGION], nextCursor: null, hasMore: false, totalCount: 1 };
    vi.mocked(listRegions).mockResolvedValueOnce(page);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof page;
    expect(body.data).toHaveLength(1);
    expect((body.data[0] as Record<string, unknown>).id).toBe(
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
    expect(body.data).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("respects query params (cursor, limit, includeArchived)", async () => {
    vi.mocked(listRegions).mockResolvedValueOnce(EMPTY_PAGE);

    const res = await createApp().request(
      `${BASE_URL}?cursor=${toCursor("abc")}&limit=5&includeArchived=true`,
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(listRegions)).toHaveBeenCalledOnce();
  });

  it("forwards includeArchived=true to service", async () => {
    vi.mocked(listRegions).mockResolvedValueOnce(EMPTY_PAGE);

    await createApp().request(`${BASE_URL}?includeArchived=true`);

    expect(vi.mocked(listRegions)).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      MOCK_AUTH,
      expect.objectContaining({ includeArchived: true }),
    );
  });

  it("returns 400 for invalid includeArchived value", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const res = await createApp().request(`${BASE_URL}?includeArchived=yes`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });
});
