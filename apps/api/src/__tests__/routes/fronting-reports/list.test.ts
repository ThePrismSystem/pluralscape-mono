import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/fronting-report/queries.js", () => ({
  listFrontingReports: vi.fn(),
}));
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listFrontingReports } = await import("../../../services/fronting-report/queries.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const REPORT_ID = "fr_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const LIST_URL = `/systems/${SYS_ID}/fronting-reports`;

const MOCK_REPORT = {
  id: REPORT_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  format: "html" as const,
  generatedAt: 5000 as never,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const MOCK_LIST_RESULT = {
  data: [MOCK_REPORT],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

// No error-mapping cases — listFrontingReports does not throw ApiHttpError.
describe("GET /systems/:systemId/fronting-reports", () => {
  beforeEach(() => {
    vi.mocked(listFrontingReports).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated list", async () => {
    vi.mocked(listFrontingReports).mockResolvedValueOnce(MOCK_LIST_RESULT);

    const res = await createApp().request(LIST_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it("passes cursor and limit query params to service", async () => {
    vi.mocked(listFrontingReports).mockResolvedValueOnce(MOCK_LIST_RESULT);

    await createApp().request(`${LIST_URL}?cursor=abc&limit=10`);

    expect(vi.mocked(listFrontingReports)).toHaveBeenCalledWith({}, SYS_ID, expect.any(Object), {
      cursor: "abc",
      limit: 10,
    });
  });

  it("uses undefined cursor when not provided", async () => {
    vi.mocked(listFrontingReports).mockResolvedValueOnce(MOCK_LIST_RESULT);

    await createApp().request(LIST_URL);

    const callOpts = vi.mocked(listFrontingReports).mock.calls[0]?.[3];
    expect(callOpts?.cursor).toBeUndefined();
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/fronting-reports`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
