import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
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

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listFriendBucketAssignments } =
  await import("../../../../services/bucket-assignment.service.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = MOCK_SYSTEM_ID;
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const CONNECTION_ID = "fc_770e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/friends`;

const MOCK_ASSIGNMENT = {
  friendConnectionId: CONNECTION_ID as never,
  bucketId: BUCKET_ID as never,
  friendAccountId: "acct_friend" as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:id/buckets/:bucketId/friends", () => {
  beforeEach(() => {
    vi.mocked(listFriendBucketAssignments).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with wrapped data array", async () => {
    vi.mocked(listFriendBucketAssignments).mockResolvedValueOnce([MOCK_ASSIGNMENT]);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: (typeof MOCK_ASSIGNMENT)[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.friendConnectionId).toBe(CONNECTION_ID);
    expect(body.data[0]?.bucketId).toBe(BUCKET_ID);
  });

  it("returns empty array when no assignments exist", async () => {
    vi.mocked(listFriendBucketAssignments).mockResolvedValueOnce([]);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: never[] };
    expect(body.data).toEqual([]);
  });

  it("passes correct args to service", async () => {
    vi.mocked(listFriendBucketAssignments).mockResolvedValueOnce([]);

    await createApp().request(BASE_URL);

    expect(vi.mocked(listFriendBucketAssignments)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      MOCK_AUTH,
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/buckets/${BUCKET_ID}/friends`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/buckets/not-valid/friends`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
