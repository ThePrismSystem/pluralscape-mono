import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/bucket/restore.js", () => ({
  restoreBucket: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { restoreBucket } = await import("../../../services/bucket/restore.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const RESTORE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/restore`;

const MOCK_RESULT = {
  id: BUCKET_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  encryptedData: "dGVzdA==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/buckets/:bucketId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreBucket).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored bucket", async () => {
    vi.mocked(restoreBucket).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(BUCKET_ID);
  });

  it("passes ids to service", async () => {
    vi.mocked(restoreBucket).mockResolvedValueOnce(MOCK_RESULT);

    await createApp().request(RESTORE_URL, { method: "POST" });

    expect(vi.mocked(restoreBucket)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/buckets/${BUCKET_ID}/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/buckets/not-valid/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    [409, "NOT_ARCHIVED", "Bucket is not archived"],
    [404, "NOT_FOUND", "Archived bucket not found"],
  ] as const)("maps service ApiHttpError %i %s to HTTP response", async (status, code, message) => {
    vi.mocked(restoreBucket).mockRejectedValueOnce(new ApiHttpError(status, code, message));

    const res = await createApp().request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(status);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe(code);
  });
});
