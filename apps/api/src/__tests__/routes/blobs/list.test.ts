import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { BlobResult } from "../../../services/blob.service.js";
import type { ApiErrorResponse, PaginatedResult } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/blob.service.js", () => ({
  createUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  getBlob: vi.fn(),
  getDownloadUrl: vi.fn(),
  archiveBlob: vi.fn(),
  listBlobs: vi.fn(),
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

const { listBlobs } = await import("../../../services/blob.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const EMPTY_PAGE: PaginatedResult<BlobResult> = {
  items: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/blobs", () => {
  beforeEach(() => {
    vi.mocked(listBlobs).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list when no blobs exist", async () => {
    vi.mocked(listBlobs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/blobs`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<BlobResult>;
    expect(body.items).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("returns 200 with paginated blobs", async () => {
    const page: PaginatedResult<BlobResult> = {
      items: [
        {
          id: "blob_660e8400-e29b-41d4-a716-446655440000" as never,
          systemId: SYS_ID as never,
          purpose: "avatar" as never,
          mimeType: "image/png",
          sizeBytes: 1024,
          checksum: "a".repeat(64),
          uploadedAt: 1700000000000 as never,
          thumbnailOfBlobId: null,
        },
      ],
      nextCursor: "blob_660e8400-e29b-41d4-a716-446655440000" as never,
      hasMore: true,
      totalCount: null,
    };
    vi.mocked(listBlobs).mockResolvedValueOnce(page);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/blobs?limit=1`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<BlobResult>;
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(true);
  });

  it("forwards systemId, auth, cursor, and limit to service", async () => {
    vi.mocked(listBlobs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/blobs?cursor=blob_abc&limit=10`);

    expect(vi.mocked(listBlobs)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      expect.objectContaining({
        limit: 10,
        includeArchived: false,
      }),
    );
  });

  it("passes default limit when not provided", async () => {
    vi.mocked(listBlobs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/blobs`);

    expect(vi.mocked(listBlobs)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      expect.objectContaining({
        limit: 25,
        includeArchived: false,
      }),
    );
  });

  it("caps limit to MAX_BLOB_LIMIT", async () => {
    vi.mocked(listBlobs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/blobs?limit=999`);

    expect(vi.mocked(listBlobs)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      expect.objectContaining({
        limit: 100,
      }),
    );
  });

  it("falls back to default for NaN limit", async () => {
    vi.mocked(listBlobs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/blobs?limit=abc`);

    expect(vi.mocked(listBlobs)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      expect.objectContaining({
        limit: 25,
      }),
    );
  });

  it("passes include_archived=true to service", async () => {
    vi.mocked(listBlobs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/blobs?include_archived=true`);

    expect(vi.mocked(listBlobs)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      MOCK_AUTH,
      expect.objectContaining({
        includeArchived: true,
      }),
    );
  });

  it("returns 400 for invalid include_archived value", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/blobs?include_archived=yes`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors as 500", async () => {
    vi.mocked(listBlobs).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/blobs`);

    expect(res.status).toBe(500);
  });
});
