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

vi.mock("../../../../services/friend-connection/lifecycle.js", () => ({
  archiveFriendConnection: vi.fn(),
  restoreFriendConnection: vi.fn(),
}));
vi.mock("../../../../services/friend-connection/queries.js", () => ({
  getFriendConnection: vi.fn(),
  listFriendConnections: vi.fn(),
}));
vi.mock("../../../../services/friend-connection/transitions.js", () => ({
  acceptFriendConnection: vi.fn(),
  blockFriendConnection: vi.fn(),
  rejectFriendConnection: vi.fn(),
  removeFriendConnection: vi.fn(),
}));
vi.mock("../../../../services/friend-connection/update.js", () => ({
  updateFriendVisibility: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { blockFriendConnection } =
  await import("../../../../services/friend-connection/transitions.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";

const MOCK_CONNECTION = {
  id: CONNECTION_ID as never,
  accountId: "acct_test" as never,
  friendAccountId: "acct_friend" as never,
  status: "blocked" as never,
  encryptedData: null,
  version: 2,
  createdAt: 1000 as never,
  updatedAt: 2000 as never,
  pendingRotations: [],
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /account/friends/:connectionId/block", () => {
  beforeEach(() => {
    vi.mocked(blockFriendConnection).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with blocked connection", async () => {
    vi.mocked(blockFriendConnection).mockResolvedValueOnce(MOCK_CONNECTION);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/block`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_CONNECTION };
    expect(body.data.id).toBe(CONNECTION_ID);
    expect(body.data.status).toBe("blocked");
  });

  it("passes correct args to service", async () => {
    vi.mocked(blockFriendConnection).mockResolvedValueOnce(MOCK_CONNECTION);

    await createApp().request(`/account/friends/${CONNECTION_ID}/block`, { method: "POST" });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(blockFriendConnection)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await createApp().request("/account/friends/not-valid/block", {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
