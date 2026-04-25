import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/bucket/list.js", () => ({
  listBuckets: vi.fn(),
  parseBucketQuery: vi.fn().mockImplementation((q: Record<string, string | undefined>) => ({
    includeArchived: q.includeArchived === "true",
    archivedOnly: q.archivedOnly === "true",
  })),
}));
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listBuckets, parseBucketQuery } = await import("../../../services/bucket/list.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const LIST_URL = `/systems/${SYS_ID}/buckets`;

const MOCK_BUCKET = {
  id: BUCKET_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

const MOCK_LIST_RESULT = {
  data: [MOCK_BUCKET],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

// No error-mapping cases — listBuckets does not throw ApiHttpError.
describe("GET /systems/:systemId/buckets", () => {
  beforeEach(() => {
    vi.mocked(listBuckets).mockReset();
    vi.mocked(parseBucketQuery).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with paginated list", async () => {
    vi.mocked(listBuckets).mockResolvedValueOnce(MOCK_LIST_RESULT);

    const res = await createApp().request(LIST_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it("passes cursor, limit, and query flags to service", async () => {
    vi.mocked(listBuckets).mockResolvedValueOnce(MOCK_LIST_RESULT);

    await createApp().request(`${LIST_URL}?cursor=abc&limit=10&includeArchived=true`);

    expect(parseBucketQuery).toHaveBeenCalledWith({
      includeArchived: "true",
      archivedOnly: undefined,
    });
    expect(vi.mocked(listBuckets)).toHaveBeenCalledWith({}, SYS_ID, expect.any(Object), {
      cursor: "abc",
      limit: 10,
      includeArchived: true,
      archivedOnly: false,
    });
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/buckets`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
