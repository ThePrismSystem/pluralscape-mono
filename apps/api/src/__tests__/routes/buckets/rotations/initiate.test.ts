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

const { initiateRotation } = await import("../../../../services/key-rotation.service.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const ROTATION_ID = "bkr_770e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations`;

const MOCK_ROTATION = {
  id: ROTATION_ID as never,
  bucketId: BUCKET_ID as never,
  fromKeyVersion: 1,
  toKeyVersion: 2,
  state: "initiated" as never,
  initiatedAt: 1000 as never,
  completedAt: null,
  totalItems: 5,
  completedItems: 0,
  failedItems: 0,
};

const VALID_BODY = {
  newKeyVersion: 2,
  friendKeyGrants: [],
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/buckets/:bucketId/rotations", () => {
  beforeEach(() => {
    vi.mocked(initiateRotation).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with new rotation", async () => {
    vi.mocked(initiateRotation).mockResolvedValueOnce(MOCK_ROTATION);

    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as typeof MOCK_ROTATION;
    expect(body.id).toBe(ROTATION_ID);
    expect(body.bucketId).toBe(BUCKET_ID);
    expect(body.fromKeyVersion).toBe(1);
    expect(body.toKeyVersion).toBe(2);
    expect(body.state).toBe("initiated");
    expect(body.totalItems).toBe(5);
    expect(body.completedItems).toBe(0);
    expect(body.failedItems).toBe(0);
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(initiateRotation).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("returns 409 when active rotation already exists", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(initiateRotation).mockRejectedValueOnce(
      new ApiHttpError(
        409,
        "ROTATION_IN_PROGRESS",
        "A rotation is already in progress for this bucket",
      ),
    );

    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ROTATION_IN_PROGRESS");
  });

  it("returns 400 for invalid systemId param format", async () => {
    const res = await createApp().request(`/systems/not-valid/buckets/${BUCKET_ID}/rotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid bucketId param format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/buckets/not-valid/rotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(400);
  });

  it("passes audit writer to service", async () => {
    vi.mocked(initiateRotation).mockResolvedValueOnce(MOCK_ROTATION);

    await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(initiateRotation).toHaveBeenCalledWith(
      expect.anything(), // db
      SYS_ID,
      BUCKET_ID,
      expect.anything(), // body
      MOCK_AUTH,
      expect.any(Function), // audit writer
    );
  });
});
