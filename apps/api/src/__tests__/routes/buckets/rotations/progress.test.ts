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

vi.mock("../../../../services/bucket/rotations/initiate.js", () => ({
  initiateRotation: vi.fn(),
}));
vi.mock("../../../../services/bucket/rotations/claim.js", () => ({
  claimRotationChunk: vi.fn(),
}));
vi.mock("../../../../services/bucket/rotations/complete.js", () => ({
  completeRotationChunk: vi.fn(),
}));
vi.mock("../../../../services/bucket/rotations/queries.js", () => ({
  getRotationProgress: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { getRotationProgress } = await import("../../../../services/bucket/rotations/queries.js");
const { createCategoryRateLimiter } = await import("../../../../middleware/rate-limit.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const ROTATION_ID = "bkr_770e8400-e29b-41d4-a716-446655440000";
const PROGRESS_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/${ROTATION_ID}`;

const MOCK_ROTATION = {
  id: ROTATION_ID as never,
  bucketId: BUCKET_ID as never,
  fromKeyVersion: 1,
  toKeyVersion: 2,
  state: "migrating" as never,
  initiatedAt: 1000 as never,
  completedAt: null,
  totalItems: 10,
  completedItems: 6,
  failedItems: 0,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id/buckets/:bucketId/rotations/:rotationId", () => {
  beforeEach(() => {
    vi.mocked(getRotationProgress).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with rotation progress", async () => {
    vi.mocked(getRotationProgress).mockResolvedValueOnce(MOCK_ROTATION);

    const res = await createApp().request(PROGRESS_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_ROTATION };
    expect(body.data.id).toBe(ROTATION_ID);
    expect(body.data.bucketId).toBe(BUCKET_ID);
    expect(body.data.state).toBe("migrating");
    expect(body.data.completedItems).toBe(6);
    expect(body.data.totalItems).toBe(10);
    expect(body.data.failedItems).toBe(0);
    expect(body.data.fromKeyVersion).toBe(1);
    expect(body.data.toKeyVersion).toBe(2);
  });

  it("returns 404 when rotation not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(getRotationProgress).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Rotation not found"),
    );

    const res = await createApp().request(PROGRESS_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid rotationId param format", async () => {
    const res = await createApp().request(
      `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/not-valid`,
    );

    expect(res.status).toBe(400);
  });

  it("applies the readDefault rate limit category", () => {
    expect(vi.mocked(createCategoryRateLimiter)).toHaveBeenCalledWith("readDefault");
  });

  it("calls service without audit writer", async () => {
    vi.mocked(getRotationProgress).mockResolvedValueOnce(MOCK_ROTATION);

    await createApp().request(PROGRESS_URL);

    expect(getRotationProgress).toHaveBeenCalledWith(
      expect.anything(), // db
      SYS_ID,
      BUCKET_ID,
      ROTATION_ID,
      MOCK_AUTH,
    );
  });
});
