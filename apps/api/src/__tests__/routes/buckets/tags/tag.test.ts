import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../../lib/api-error.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/bucket-content-tag.service.js", () => ({
  tagContent: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { tagContent } = await import("../../../../services/bucket-content-tag.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/tags`;

const VALID_BODY = {
  entityType: "member" as const,
  entityId: "mem_770e8400-e29b-41d4-a716-446655440000",
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/buckets/:bucketId/tags", () => {
  beforeEach(() => {
    vi.mocked(tagContent).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with tag result", async () => {
    vi.mocked(tagContent).mockResolvedValueOnce({
      entityType: "member",
      entityId: VALID_BODY.entityId,
      bucketId: BUCKET_ID as never,
    });

    const res = await postJSON(createApp(), BASE_URL, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { entityId: string } };
    expect(body.data.entityId).toBe(VALID_BODY.entityId);
  });

  it("passes parsed body and ids to service", async () => {
    vi.mocked(tagContent).mockResolvedValueOnce({
      entityType: "member",
      entityId: VALID_BODY.entityId,
      bucketId: BUCKET_ID as never,
    });

    await postJSON(createApp(), BASE_URL, VALID_BODY);

    expect(vi.mocked(tagContent)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      VALID_BODY,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await postJSON(
      createApp(),
      `/systems/not-valid/buckets/${BUCKET_ID}/tags`,
      VALID_BODY,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await postJSON(
      createApp(),
      `/systems/${SYS_ID}/buckets/not-valid/tags`,
      VALID_BODY,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([[400, "VALIDATION_ERROR", "Invalid tag content payload"]] as const)(
    "maps service ApiHttpError %i %s to HTTP response",
    async (status, code, message) => {
      vi.mocked(tagContent).mockRejectedValueOnce(new ApiHttpError(status, code, message));

      const res = await postJSON(createApp(), BASE_URL, VALID_BODY);

      expect(res.status).toBe(status);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe(code);
    },
  );
});
