import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, putJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/bucket.service.js", () => ({
  updateBucket: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { updateBucket } = await import("../../../services/bucket.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const UPDATE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}`;

const VALID_BODY = { encryptedData: "dXBkYXRlZA==", version: 2 };

const MOCK_RESULT = {
  id: BUCKET_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  encryptedData: "dXBkYXRlZA==",
  version: 2,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 3000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:systemId/buckets/:bucketId", () => {
  beforeEach(() => {
    vi.mocked(updateBucket).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated bucket", async () => {
    vi.mocked(updateBucket).mockResolvedValueOnce(MOCK_RESULT);

    const res = await putJSON(createApp(), UPDATE_URL, VALID_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(2);
  });

  it("passes body and ids to service", async () => {
    vi.mocked(updateBucket).mockResolvedValueOnce(MOCK_RESULT);

    await putJSON(createApp(), UPDATE_URL, VALID_BODY);

    expect(vi.mocked(updateBucket)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      VALID_BODY,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await putJSON(createApp(), `/systems/not-valid/buckets/${BUCKET_ID}`, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await putJSON(createApp(), `/systems/${SYS_ID}/buckets/not-valid`, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await createApp().request(UPDATE_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
