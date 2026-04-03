import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/friend-connection.service.js", () => ({
  listFriendConnections: vi.fn(),
  getFriendConnection: vi.fn(),
  blockFriendConnection: vi.fn(),
  removeFriendConnection: vi.fn(),
  acceptFriendConnection: vi.fn(),
  rejectFriendConnection: vi.fn(),
  updateFriendVisibility: vi.fn(),
  archiveFriendConnection: vi.fn(),
  restoreFriendConnection: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { acceptFriendConnection, rejectFriendConnection } =
  await import("../../../../services/friend-connection.service.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";

const MOCK_ACCEPTED_CONNECTION = {
  id: CONNECTION_ID as never,
  accountId: "acct_test" as never,
  friendAccountId: "acct_friend" as never,
  status: "accepted" as never,
  encryptedData: null,
  version: 2,
  createdAt: 1000 as never,
  updatedAt: 2000 as never,
};

const MOCK_REJECTED_CONNECTION = {
  id: CONNECTION_ID as never,
  accountId: "acct_test" as never,
  friendAccountId: "acct_friend" as never,
  status: "removed" as never,
  encryptedData: null,
  version: 2,
  createdAt: 1000 as never,
  updatedAt: 2000 as never,
};

// ── Tests: Accept ───────────────────────────────────────────────

describe("POST /account/friends/:connectionId/accept", () => {
  beforeEach(() => {
    vi.mocked(acceptFriendConnection).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with accepted connection", async () => {
    vi.mocked(acceptFriendConnection).mockResolvedValueOnce(MOCK_ACCEPTED_CONNECTION);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/accept`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_ACCEPTED_CONNECTION };
    expect(body.data.id).toBe(CONNECTION_ID);
    expect(body.data.status).toBe("accepted");
  });

  it("passes correct args to service", async () => {
    vi.mocked(acceptFriendConnection).mockResolvedValueOnce(MOCK_ACCEPTED_CONNECTION);

    await createApp().request(`/account/friends/${CONNECTION_ID}/accept`, { method: "POST" });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(acceptFriendConnection)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await createApp().request("/account/friends/not-valid/accept", {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── Tests: Reject ───────────────────────────────────────────────

describe("POST /account/friends/:connectionId/reject", () => {
  beforeEach(() => {
    vi.mocked(rejectFriendConnection).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with rejected connection", async () => {
    vi.mocked(rejectFriendConnection).mockResolvedValueOnce(MOCK_REJECTED_CONNECTION);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/reject`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_REJECTED_CONNECTION };
    expect(body.data.id).toBe(CONNECTION_ID);
    expect(body.data.status).toBe("removed");
  });

  it("passes correct args to service", async () => {
    vi.mocked(rejectFriendConnection).mockResolvedValueOnce(MOCK_REJECTED_CONNECTION);

    await createApp().request(`/account/friends/${CONNECTION_ID}/reject`, { method: "POST" });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(rejectFriendConnection)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await createApp().request("/account/friends/not-valid/reject", {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
