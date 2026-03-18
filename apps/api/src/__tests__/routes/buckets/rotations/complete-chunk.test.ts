import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";


// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/key-rotation.service.js", () => ({
  initiateRotation: vi.fn(),
  claimRotationChunk: vi.fn(),
  completeRotationChunk: vi.fn(),
  getRotationProgress: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

vi.mock("../../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { completeRotationChunk } = await import("../../../../services/key-rotation.service.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const ROTATION_ID = "bkr_770e8400-e29b-41d4-a716-446655440000";
const COMPLETE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/${ROTATION_ID}/complete`;

const MOCK_COMPLETION_RESPONSE = {
  rotation: {
    id: ROTATION_ID as never,
    bucketId: BUCKET_ID as never,
    fromKeyVersion: 1,
    toKeyVersion: 2,
    state: "migrating" as never,
    initiatedAt: 1000 as never,
    completedAt: null,
    totalItems: 5,
    completedItems: 3,
    failedItems: 0,
  },
  transitioned: false,
};

const VALID_BODY = {
  items: [{ itemId: "bri_880e8400-e29b-41d4-a716-446655440000", status: "completed" }],
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/buckets/:bucketId/rotations/:rotationId/complete", () => {
  beforeEach(() => {
    vi.mocked(completeRotationChunk).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with rotation and transitioned flag", async () => {
    vi.mocked(completeRotationChunk).mockResolvedValueOnce(MOCK_COMPLETION_RESPONSE);

    const res = await createApp().request(COMPLETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_COMPLETION_RESPONSE;
    expect(body.rotation.id).toBe(ROTATION_ID);
    expect(body.rotation.bucketId).toBe(BUCKET_ID);
    expect(body.rotation.state).toBe("migrating");
    expect(body.rotation.completedItems).toBe(3);
    expect(body.rotation.totalItems).toBe(5);
    expect(body.rotation.failedItems).toBe(0);
    expect(body.transitioned).toBe(false);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(COMPLETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(completeRotationChunk).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(COMPLETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when rotation not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(completeRotationChunk).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Rotation not found"),
    );

    const res = await createApp().request(COMPLETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid rotationId param format", async () => {
    const res = await createApp().request(
      `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/not-valid/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      },
    );

    expect(res.status).toBe(400);
  });

  it("passes audit writer to service", async () => {
    vi.mocked(completeRotationChunk).mockResolvedValueOnce(MOCK_COMPLETION_RESPONSE);

    await createApp().request(COMPLETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(completeRotationChunk).toHaveBeenCalledWith(
      expect.anything(), // db
      SYS_ID,
      BUCKET_ID,
      ROTATION_ID,
      expect.anything(), // body
      MOCK_AUTH,
      expect.any(Function), // audit writer
    );
  });
});
