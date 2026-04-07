import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, MOCK_SYSTEM_ID, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/bucket-assignment.service.js", () => ({
  assignBucketToFriend: vi.fn(),
  unassignBucketFromFriend: vi.fn(),
  listFriendBucketAssignments: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { unassignBucketFromFriend } =
  await import("../../../../services/bucket-assignment.service.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = MOCK_SYSTEM_ID;
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const CONNECTION_ID = "fc_770e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/friends/${CONNECTION_ID}`;

const MOCK_UNASSIGN_RESULT = {
  pendingRotation: {
    systemId: SYS_ID as never,
    bucketId: BUCKET_ID as never,
  },
};

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:id/buckets/:bucketId/friends/:connectionId", () => {
  beforeEach(() => {
    vi.mocked(unassignBucketFromFriend).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with pending rotation result", async () => {
    vi.mocked(unassignBucketFromFriend).mockResolvedValueOnce(MOCK_UNASSIGN_RESULT);

    const res = await createApp().request(BASE_URL, { method: "DELETE" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_UNASSIGN_RESULT };
    expect(body.data.pendingRotation.systemId).toBe(SYS_ID);
    expect(body.data.pendingRotation.bucketId).toBe(BUCKET_ID);
  });

  it("passes correct args to service", async () => {
    vi.mocked(unassignBucketFromFriend).mockResolvedValueOnce(MOCK_UNASSIGN_RESULT);

    await createApp().request(BASE_URL, { method: "DELETE" });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(unassignBucketFromFriend)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      CONNECTION_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(
      `/systems/not-valid/buckets/${BUCKET_ID}/friends/${CONNECTION_ID}`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(
      `/systems/${SYS_ID}/buckets/not-valid/friends/${CONNECTION_ID}`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await createApp().request(
      `/systems/${SYS_ID}/buckets/${BUCKET_ID}/friends/not-valid`,
      { method: "DELETE" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
