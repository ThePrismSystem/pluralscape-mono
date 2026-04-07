import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

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

const { assignBucketToFriend } = await import("../../../../services/bucket-assignment.service.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { systemRoutes } = await import("../../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BUCKET_ID = "bkt_660e8400-e29b-41d4-a716-446655440000";
const CONNECTION_ID = "fc_770e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYS_ID}/buckets/${BUCKET_ID}/friends`;

const VALID_BODY = {
  connectionId: CONNECTION_ID,
  encryptedBucketKey: "dGVzdC1rZXk=",
  keyVersion: 1,
};

const MOCK_ASSIGNMENT = {
  friendConnectionId: CONNECTION_ID as never,
  bucketId: BUCKET_ID as never,
  friendAccountId: "acct_friend" as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/buckets/:bucketId/friends", () => {
  beforeEach(() => {
    vi.mocked(assignBucketToFriend).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with assignment result", async () => {
    vi.mocked(assignBucketToFriend).mockResolvedValueOnce(MOCK_ASSIGNMENT);

    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: typeof MOCK_ASSIGNMENT };
    expect(body.data.friendConnectionId).toBe(CONNECTION_ID);
    expect(body.data.bucketId).toBe(BUCKET_ID);
  });

  it("passes correct args to service", async () => {
    vi.mocked(assignBucketToFriend).mockResolvedValueOnce(MOCK_ASSIGNMENT);

    await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(assignBucketToFriend)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      BUCKET_ID,
      expect.anything(),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/buckets/${BUCKET_ID}/friends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid bucketId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/buckets/not-valid/friends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });
});
