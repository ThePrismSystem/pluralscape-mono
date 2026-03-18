import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/blob.service.js", () => ({
  createUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  getBlob: vi.fn(),
  getDownloadUrl: vi.fn(),
  archiveBlob: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../lib/storage.js", () => ({
  getStorageAdapter: vi.fn().mockReturnValue({}),
  getQuotaService: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { archiveBlob } = await import("../../../services/blob.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/blobs/blob_660e8400-e29b-41d4-a716-446655440000";

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:systemId/blobs/:blobId", () => {
  beforeEach(() => {
    vi.mocked(archiveBlob).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 No Content", async () => {
    vi.mocked(archiveBlob).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(BASE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when blob not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveBlob).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Blob not found"),
    );

    const app = createApp();
    const res = await app.request(BASE_URL, { method: "DELETE" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid blobId param format", async () => {
    const invalidUrl = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/blobs/not-valid";

    const app = createApp();
    const res = await app.request(invalidUrl, { method: "DELETE" });

    expect(res.status).toBe(400);
  });
});
