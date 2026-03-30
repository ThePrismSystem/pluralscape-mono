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

vi.mock("../../../../services/key-rotation.service.js", () => ({
  initiateRotation: vi.fn(),
  claimRotationChunk: vi.fn(),
  completeRotationChunk: vi.fn(),
  getRotationProgress: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { claimRotationChunk } = await import("../../../../services/key-rotation.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const ROTATION_ID = "bkr_770e8400-e29b-41d4-a716-446655440000";
const CLAIM_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/${ROTATION_ID}/claim`;

const MOCK_CLAIM_RESPONSE = {
  data: [
    {
      id: "bri_880e8400-e29b-41d4-a716-446655440000" as never,
      rotationId: ROTATION_ID as never,
      entityType: "content_tag" as never,
      entityId: "ct_990e8400-e29b-41d4-a716-446655440000",
      status: "claimed" as never,
      claimedBy: "sess_test",
      claimedAt: 1000 as never,
      completedAt: null,
      attempts: 0,
    },
  ],
  rotationState: "migrating" as never,
};

const VALID_BODY = { chunkSize: 10 };

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/buckets/:bucketId/rotations/:rotationId/claim", () => {
  beforeEach(() => {
    vi.mocked(claimRotationChunk).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with claimed items and rotation state", async () => {
    vi.mocked(claimRotationChunk).mockResolvedValueOnce(MOCK_CLAIM_RESPONSE);

    const res = await createApp().request(CLAIM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_CLAIM_RESPONSE;
    expect(body.data).toHaveLength(1);
    expect(body.rotationState).toBe("migrating");
    expect((body.data[0] as Record<string, unknown>).id).toBe(
      "bri_880e8400-e29b-41d4-a716-446655440000",
    );
    expect((body.data[0] as Record<string, unknown>).status).toBe("claimed");
    expect((body.data[0] as Record<string, unknown>).entityType).toBe("content_tag");
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(CLAIM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(claimRotationChunk).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(CLAIM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when rotation not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(claimRotationChunk).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Rotation not found"),
    );

    const res = await createApp().request(CLAIM_URL, {
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
      `/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/not-valid/claim`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      },
    );

    expect(res.status).toBe(400);
  });

  it("does not use audit writer", async () => {
    vi.mocked(claimRotationChunk).mockResolvedValueOnce(MOCK_CLAIM_RESPONSE);

    await createApp().request(CLAIM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    // claimRotationChunk is called without an audit writer argument
    expect(claimRotationChunk).toHaveBeenCalledWith(
      expect.anything(), // db
      SYS_ID,
      BUCKET_ID,
      ROTATION_ID,
      expect.anything(), // body
      MOCK_AUTH,
    );
  });
});
