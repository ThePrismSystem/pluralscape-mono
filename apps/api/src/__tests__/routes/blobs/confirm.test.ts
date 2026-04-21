import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { BlobResult } from "../../../services/blob/internal.js";
import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/blob/confirm-upload.js", () => ({
  confirmUpload: vi.fn(),
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

const { confirmUpload } = await import("../../../services/blob/confirm-upload.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BLOB_ID = "blob_660e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/sys_550e8400-e29b-41d4-a716-446655440000/blobs/${BLOB_ID}/confirm`;

const MOCK_BLOB_RESULT = {
  id: BLOB_ID,
  systemId: MOCK_AUTH.systemId,
  purpose: "avatar",
  mimeType: "image/png",
  sizeBytes: 1024,
  checksum: "a".repeat(64),
  uploadedAt: 1700000000000,
  thumbnailOfBlobId: null,
} as BlobResult;

const VALID_BODY = {
  checksum: "a".repeat(64),
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/blobs/:blobId/confirm", () => {
  beforeEach(() => {
    vi.mocked(confirmUpload).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with confirmed blob", async () => {
    vi.mocked(confirmUpload).mockResolvedValueOnce(MOCK_BLOB_RESULT);

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_BLOB_RESULT };
    expect(body.data.id).toBe(BLOB_ID);
    expect(body.data.checksum).toBe("a".repeat(64));
    expect(body.data.mimeType).toBe("image/png");
    expect(body.data.sizeBytes).toBe(1024);
    expect(body.data.purpose).toBe("avatar");
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

  it("returns 400 for empty object body", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(confirmUpload).mockRejectedValueOnce(
      new ApiHttpError(400, "VALIDATION_ERROR", "Missing required fields"),
    );
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when blob not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(confirmUpload).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Blob not found"),
    );

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid blobId param format", async () => {
    const invalidUrl = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/blobs/not-valid/confirm";

    const app = createApp();
    const res = await app.request(invalidUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(400);
  });
});
