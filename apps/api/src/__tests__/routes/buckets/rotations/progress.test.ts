import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../../middleware/request-id.js";

import type { AuthContext } from "../../../../lib/auth-context.js";
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

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

vi.mock("../../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getRotationProgress } = await import("../../../../services/key-rotation.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

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

    const app = createApp();
    const res = await app.request(PROGRESS_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_ROTATION;
    expect(body.id).toBe(ROTATION_ID);
    expect(body.state).toBe("migrating");
    expect(body.completedItems).toBe(6);
    expect(body.totalItems).toBe(10);
  });

  it("returns 404 when rotation not found", async () => {
    const { ApiHttpError } = await import("../../../../lib/api-error.js");
    vi.mocked(getRotationProgress).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Rotation not found"),
    );

    const app = createApp();
    const res = await app.request(PROGRESS_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid rotationId param format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/buckets/${BUCKET_ID}/rotations/not-valid`);

    expect(res.status).toBe(400);
  });

  it("calls service without audit writer", async () => {
    vi.mocked(getRotationProgress).mockResolvedValueOnce(MOCK_ROTATION);

    const app = createApp();
    await app.request(PROGRESS_URL);

    expect(getRotationProgress).toHaveBeenCalledWith(
      expect.anything(), // db
      SYS_ID,
      BUCKET_ID,
      ROTATION_ID,
      MOCK_AUTH,
    );
  });
});
