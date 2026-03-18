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

const { initiateRotation } = await import("../../../../services/key-rotation.service.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
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

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(ROTATION_ID);
  });

  it("returns 400 for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
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

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ROTATION_IN_PROGRESS");
  });

  it("returns 400 for invalid systemId param format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/not-valid/buckets/${BUCKET_ID}/rotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid bucketId param format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/buckets/not-valid/rotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(400);
  });

  it("passes audit writer to service", async () => {
    vi.mocked(initiateRotation).mockResolvedValueOnce(MOCK_ROTATION);

    const app = createApp();
    await app.request(BASE_URL, {
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
