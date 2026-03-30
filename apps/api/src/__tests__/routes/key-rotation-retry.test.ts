import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/key-rotation.service.js", () => ({
  initiateRotation: vi.fn(),
  claimRotationChunk: vi.fn(),
  completeRotationChunk: vi.fn(),
  getRotationProgress: vi.fn(),
  retryRotation: vi.fn(),
}));

vi.mock("../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../lib/db.js", () => mockDbFactory());

vi.mock("../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { retryRotation } = await import("../../services/key-rotation.service.js");
const { systemRoutes } = await import("../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_550e8400-e29b-41d4-a716-446655440001";
const ROTATION_ID = "bkr_550e8400-e29b-41d4-a716-446655440002";

const createApp = () => createRouteApp("/systems", systemRoutes);

const RETRY_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/${ROTATION_ID}/retry`;

const MOCK_ROTATION = {
  id: ROTATION_ID as never,
  bucketId: BUCKET_ID as never,
  fromKeyVersion: 1,
  toKeyVersion: 2,
  state: "migrating" as const,
  initiatedAt: 1000 as never,
  completedAt: null,
  totalItems: 10,
  completedItems: 7,
  failedItems: 0,
};

// ── Tests: POST /:rotationId/retry ──────────────────────────────

describe("POST /systems/:id/buckets/:bucketId/rotations/:rotationId/retry", () => {
  beforeEach(() => vi.mocked(retryRotation).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 on success", async () => {
    vi.mocked(retryRotation).mockResolvedValueOnce(MOCK_ROTATION);
    const app = createApp();
    const res = await postJSON(app, RETRY_URL, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string; state: string } };
    expect(body.data.id).toBe(ROTATION_ID);
    expect(body.data.state).toBe("migrating");
  });

  it("forwards systemId, bucketId, rotationId, auth to service", async () => {
    vi.mocked(retryRotation).mockResolvedValueOnce(MOCK_ROTATION);
    const app = createApp();
    await postJSON(app, RETRY_URL, {});
    expect(vi.mocked(retryRotation)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      BUCKET_ID,
      ROTATION_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid rotationId format", async () => {
    const app = createApp();
    const res = await postJSON(
      app,
      `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/bad-id/retry`,
      {},
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(retryRotation).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Rotation not found"),
    );
    const app = createApp();
    const res = await postJSON(app, RETRY_URL, {});
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when rotation is not in failed state", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(retryRotation).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Only failed rotations can be retried"),
    );
    const app = createApp();
    const res = await postJSON(app, RETRY_URL, {});
    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(retryRotation).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    const res = await postJSON(app, RETRY_URL, {});
    expect(res.status).toBe(500);
  });
});
