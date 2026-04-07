import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/bucket-content-tag.service.js", () => ({
  untagContent: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { untagContent } = await import("../../../../services/bucket-content-tag.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const ENTITY_ID = "mem_770e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/tags/member/${ENTITY_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:id/buckets/:bucketId/tags/:entityType/:entityId", () => {
  beforeEach(() => {
    vi.mocked(untagContent).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(untagContent).mockResolvedValueOnce(undefined);

    const res = await createApp().request(BASE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("passes ids to service", async () => {
    vi.mocked(untagContent).mockResolvedValueOnce(undefined);

    await createApp().request(BASE_URL, { method: "DELETE" });

    expect(vi.mocked(untagContent)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      "member",
      ENTITY_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid entityType", async () => {
    const res = await createApp().request(
      `/systems/${SYS_ID}/buckets/${BUCKET_ID}/tags/garbage/${ENTITY_ID}`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(vi.mocked(untagContent)).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(
      `/systems/not-valid/buckets/${BUCKET_ID}/tags/member/${ENTITY_ID}`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(
      `/systems/${SYS_ID}/buckets/not-valid/tags/member/${ENTITY_ID}`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
