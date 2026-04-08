import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/bucket.service.js", () => ({
  deleteBucket: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { deleteBucket } = await import("../../../services/bucket.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const DELETE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:systemId/buckets/:bucketId", () => {
  beforeEach(() => {
    vi.mocked(deleteBucket).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteBucket).mockResolvedValueOnce(undefined);

    const res = await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("passes ids to service", async () => {
    vi.mocked(deleteBucket).mockResolvedValueOnce(undefined);

    await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(vi.mocked(deleteBucket)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/buckets/${BUCKET_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/buckets/not-valid`, {
      method: "DELETE",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    [404, "NOT_FOUND", "Bucket not found"],
    [409, "HAS_DEPENDENTS", "Bucket has dependents. Remove all dependents before deleting."],
  ] as const)("maps service ApiHttpError %i %s to HTTP response", async (status, code, message) => {
    vi.mocked(deleteBucket).mockRejectedValueOnce(new ApiHttpError(status, code, message));

    const res = await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(res.status).toBe(status);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe(code);
  });
});
