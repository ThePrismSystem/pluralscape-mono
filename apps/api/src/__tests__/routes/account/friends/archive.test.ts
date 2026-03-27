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
  updateFriendVisibility: vi.fn(),
  archiveFriendConnection: vi.fn(),
  restoreFriendConnection: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { archiveFriendConnection } =
  await import("../../../../services/friend-connection.service.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";

// ── Tests ────────────────────────────────────────────────────────

describe("POST /account/friends/:connectionId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveFriendConnection).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveFriendConnection).mockResolvedValueOnce(undefined);

    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(204);
  });

  it("passes correct args to service", async () => {
    vi.mocked(archiveFriendConnection).mockResolvedValueOnce(undefined);

    await createApp().request(`/account/friends/${CONNECTION_ID}/archive`, { method: "POST" });

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(archiveFriendConnection)).toHaveBeenCalledWith(
      {},
      "acct_test",
      CONNECTION_ID,
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await createApp().request("/account/friends/not-valid/archive", {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
