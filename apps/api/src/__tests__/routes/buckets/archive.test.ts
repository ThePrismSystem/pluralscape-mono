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

vi.mock("../../../services/bucket.service.js", () => ({
  archiveBucket: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { archiveBucket } = await import("../../../services/bucket.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const ARCHIVE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/archive`;

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/buckets/:bucketId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveBucket).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveBucket).mockResolvedValueOnce(undefined);

    const res = await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("passes ids to service", async () => {
    vi.mocked(archiveBucket).mockResolvedValueOnce(undefined);

    await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(vi.mocked(archiveBucket)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/buckets/${BUCKET_ID}/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/buckets/not-valid/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
