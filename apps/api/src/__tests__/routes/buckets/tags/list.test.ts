import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/bucket-content-tag.service.js", () => ({
  listTagsByBucket: vi.fn(),
  parseTagQuery: vi.fn().mockImplementation((q: { entityType?: string }) => ({
    entityType: q.entityType,
  })),
}));

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listTagsByBucket, parseTagQuery } =
  await import("../../../../services/bucket-content-tag.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/tags`;

// ── Tests ────────────────────────────────────────────────────────

// No error-mapping cases — listTagsByBucket does not throw ApiHttpError.
describe("GET /systems/:id/buckets/:bucketId/tags", () => {
  beforeEach(() => {
    vi.mocked(listTagsByBucket).mockReset();
    vi.mocked(parseTagQuery).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with tag list", async () => {
    vi.mocked(listTagsByBucket).mockResolvedValueOnce([
      { entityType: "member" as never, entityId: "mem_test", bucketId: BUCKET_ID as never },
    ]);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it("passes entityType query to parseTagQuery", async () => {
    vi.mocked(listTagsByBucket).mockResolvedValueOnce([]);

    await createApp().request(`${BASE_URL}?entityType=member`);

    expect(parseTagQuery).toHaveBeenCalledWith({ entityType: "member" });
  });

  it("calls service with parsed entityType", async () => {
    vi.mocked(listTagsByBucket).mockResolvedValueOnce([]);

    await createApp().request(`${BASE_URL}?entityType=member`);

    expect(vi.mocked(listTagsByBucket)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      expect.any(Object),
      { entityType: "member" },
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/buckets/${BUCKET_ID}/tags`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/buckets/not-valid/tags`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
