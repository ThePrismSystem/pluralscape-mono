import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../../middleware/error-handler.js";
import { requestIdMiddleware } from "../../../middleware/request-id.js";

import type { AuthContext } from "../../../lib/auth-context.js";
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

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test" as AuthContext["accountId"],
  systemId: "sys_550e8400-e29b-41d4-a716-446655440000" as AuthContext["systemId"],
  sessionId: "sess_test" as AuthContext["sessionId"],
  accountType: "system",
};

vi.mock("../../../middleware/auth.js", () => ({
  authMiddleware: vi
    .fn()
    .mockImplementation(() => async (c: Context, next: () => Promise<void>) => {
      c.set("auth", MOCK_AUTH);
      await next();
    }),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { createUploadUrl } = await import("../../../services/blob.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

function createApp(): Hono {
  const app = new Hono();
  app.use("*", requestIdMiddleware());
  app.route("/systems", systemRoutes);
  app.onError(errorHandler);
  return app;
}

const BASE_URL = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/blobs/upload-url";

const MOCK_UPLOAD_RESULT = {
  blobId: "blob_660e8400-e29b-41d4-a716-446655440000" as never,
  uploadUrl: "https://storage.example.com/presigned-upload",
  expiresAt: 1700000000000 as never,
};

const VALID_BODY = {
  purpose: "avatar",
  mimeType: "image/png",
  sizeBytes: 1024,
  encryptionTier: "none",
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/blobs/upload-url", () => {
  beforeEach(() => {
    vi.mocked(createUploadUrl).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with blob ID and upload URL", async () => {
    vi.mocked(createUploadUrl).mockResolvedValueOnce(MOCK_UPLOAD_RESULT);

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as typeof MOCK_UPLOAD_RESULT;
    expect(body.blobId).toBe("blob_660e8400-e29b-41d4-a716-446655440000");
    expect(body.uploadUrl).toBe("https://storage.example.com/presigned-upload");
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

  it("returns 413 when file is too large", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(createUploadUrl).mockRejectedValueOnce(
      new ApiHttpError(413, "BLOB_TOO_LARGE", "File size exceeds maximum"),
    );

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(413);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("BLOB_TOO_LARGE");
  });

  it("returns 413 when quota is exceeded", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(createUploadUrl).mockRejectedValueOnce(
      new ApiHttpError(413, "QUOTA_EXCEEDED", "Storage quota exceeded"),
    );

    const app = createApp();
    const res = await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(413);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("calls service with correct arguments", async () => {
    vi.mocked(createUploadUrl).mockResolvedValueOnce(MOCK_UPLOAD_RESULT);

    const app = createApp();
    await app.request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(createUploadUrl).toHaveBeenCalledOnce();
    const args = vi.mocked(createUploadUrl).mock.calls[0] as unknown[];
    // db, storageAdapter, quotaService, systemId, body, auth, audit
    expect(args[3]).toBe(MOCK_AUTH.systemId);
    expect(args[4]).toEqual(VALID_BODY);
  });
});
