import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";
import type { Context } from "hono";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/blob.service.js", () => ({
  createUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  getBlob: vi.fn(),
  getDownloadUrl: vi.fn(),
  archiveBlob: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => ({
  createAuditWriter: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../lib/storage.js", () => ({
  getStorageAdapter: vi.fn().mockReturnValue({}),
  getQuotaService: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  createCategoryRateLimiter: vi
    .fn()
    .mockImplementation(() => async (_c: Context, next: () => Promise<void>) => {
      await next();
    }),
}));

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { getDownloadUrl } = await import("../../../services/blob.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BLOB_ID = "blob_660e8400-e29b-41d4-a716-446655440000";
const BASE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/blobs/blob_660e8400-e29b-41d4-a716-446655440000/download-url";

const MOCK_DOWNLOAD_RESULT = {
  blobId: BLOB_ID as never,
  downloadUrl: "https://storage.example.com/presigned-download",
  expiresAt: 1700000000000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/blobs/:blobId/download-url", () => {
  beforeEach(() => {
    vi.mocked(getDownloadUrl).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with download URL", async () => {
    vi.mocked(getDownloadUrl).mockResolvedValueOnce(MOCK_DOWNLOAD_RESULT);

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_DOWNLOAD_RESULT;
    expect(body.blobId).toBe(BLOB_ID);
    expect(body.downloadUrl).toBe("https://storage.example.com/presigned-download");
    expect(body.expiresAt).toBe(1700000000000);
  });

  it("returns 404 when blob not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(getDownloadUrl).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Blob not found"),
    );

    const app = createApp();
    const res = await app.request(BASE_URL);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid blobId param format", async () => {
    const invalidUrl =
      "/systems/sys_550e8400-e29b-41d4-a716-446655440000/blobs/not-valid/download-url";

    const app = createApp();
    const res = await app.request(invalidUrl);

    expect(res.status).toBe(400);
  });
});
