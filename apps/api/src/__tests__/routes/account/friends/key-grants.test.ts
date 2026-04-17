import { brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import { MOCK_ACCOUNT_ONLY_AUTH, createRouteApp } from "../../../helpers/route-test-setup.js";

import type { BucketId, KeyGrantId, ReceivedKeyGrantsResponse, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/key-grant.service.js", () => ({
  listReceivedKeyGrants: vi.fn(),
}));

vi.mock("../../../../services/friend-connection.service.js", () => ({
  acceptFriendConnection: vi.fn(),
  archiveFriendConnection: vi.fn(),
  blockFriendConnection: vi.fn(),
  getFriendConnection: vi.fn(),
  listFriendConnections: vi.fn(),
  rejectFriendConnection: vi.fn(),
  removeFriendConnection: vi.fn(),
  restoreFriendConnection: vi.fn(),
  updateFriendVisibility: vi.fn(),
}));

vi.mock("../../../../services/friend-notification-preference.service.js", () => ({
  getOrCreateFriendNotificationPreference: vi.fn(),
  updateFriendNotificationPreference: vi.fn(),
  listFriendNotificationPreferences: vi.fn(),
}));

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { listReceivedKeyGrants } = await import("../../../../services/key-grant.service.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("GET /account/friends/key-grants", () => {
  beforeEach(() => {
    vi.mocked(listReceivedKeyGrants).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with grants in envelope", async () => {
    const mockResult: ReceivedKeyGrantsResponse = {
      grants: [
        {
          id: brandId<KeyGrantId>("kg_1"),
          bucketId: brandId<BucketId>("bkt_abc"),
          encryptedKey: "base64key",
          keyVersion: 1,
          grantorSystemId: brandId<SystemId>("sys_xyz"),
          senderBoxPublicKey: "base64urlpubkey",
        },
      ],
    };
    vi.mocked(listReceivedKeyGrants).mockResolvedValueOnce(mockResult);

    const res = await createApp().request("/account/friends/key-grants");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ReceivedKeyGrantsResponse };
    expect(body.data).toEqual(mockResult);
  });

  it("calls service with the authenticated account ID", async () => {
    vi.mocked(listReceivedKeyGrants).mockResolvedValueOnce({ grants: [] });

    await createApp().request("/account/friends/key-grants");

    expect(listReceivedKeyGrants).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_ACCOUNT_ONLY_AUTH.accountId,
    );
  });

  it("returns empty grants array when none exist", async () => {
    vi.mocked(listReceivedKeyGrants).mockResolvedValueOnce({ grants: [] });

    const res = await createApp().request("/account/friends/key-grants");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: ReceivedKeyGrantsResponse };
    expect(body.data.grants).toEqual([]);
  });
});
