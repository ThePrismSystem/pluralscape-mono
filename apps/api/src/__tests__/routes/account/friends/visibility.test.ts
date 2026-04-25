import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../../helpers/common-route-mocks.js";
import {
  MOCK_ACCOUNT_ONLY_AUTH,
  createRouteApp,
  putJSON,
} from "../../../helpers/route-test-setup.js";

import type { EncryptedBase64, ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../../services/account/friends/lifecycle.js", () => ({
  archiveFriendConnection: vi.fn(),
  restoreFriendConnection: vi.fn(),
}));
vi.mock("../../../../services/account/friends/queries.js", () => ({
  getFriendConnection: vi.fn(),
  listFriendConnections: vi.fn(),
}));
vi.mock("../../../../services/account/friends/transitions.js", () => ({
  acceptFriendConnection: vi.fn(),
  blockFriendConnection: vi.fn(),
  rejectFriendConnection: vi.fn(),
  removeFriendConnection: vi.fn(),
}));
vi.mock("../../../../services/account/friends/update.js", () => ({
  updateFriendVisibility: vi.fn(),
}));

vi.mock("../../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { updateFriendVisibility } = await import("../../../../services/account/friends/update.js");
const { createAuditWriter } = await import("../../../../lib/audit-writer.js");
const { accountRoutes } = await import("../../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

const CONNECTION_ID = "fc_550e8400-e29b-41d4-a716-446655440000";

const VALID_BODY = {
  encryptedData: "dGVzdC1lbmNyeXB0ZWQtZGF0YQ==" as EncryptedBase64,
  version: 1,
};

const MOCK_CONNECTION = {
  id: CONNECTION_ID as never,
  accountId: "acct_test" as never,
  friendAccountId: "acct_friend" as never,
  status: "accepted" as never,
  encryptedData: VALID_BODY.encryptedData,
  version: 2,
  createdAt: 1000 as never,
  updatedAt: 2000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /account/friends/:connectionId/visibility", () => {
  beforeEach(() => {
    vi.mocked(updateFriendVisibility).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated connection", async () => {
    vi.mocked(updateFriendVisibility).mockResolvedValueOnce(MOCK_CONNECTION);

    const res = await putJSON(
      createApp(),
      `/account/friends/${CONNECTION_ID}/visibility`,
      VALID_BODY,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_CONNECTION };
    expect(body.data.id).toBe(CONNECTION_ID);
    expect(body.data.encryptedData).toBe(VALID_BODY.encryptedData);
  });

  it("passes correct args to service", async () => {
    vi.mocked(updateFriendVisibility).mockResolvedValueOnce(MOCK_CONNECTION);

    await putJSON(createApp(), `/account/friends/${CONNECTION_ID}/visibility`, VALID_BODY);

    expect(createAuditWriter).toHaveBeenCalled();
    expect(vi.mocked(updateFriendVisibility)).toHaveBeenCalledWith(
      {},
      "acct_test001",
      CONNECTION_ID,
      VALID_BODY,
      MOCK_ACCOUNT_ONLY_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid connectionId format", async () => {
    const res = await putJSON(createApp(), "/account/friends/not-valid/visibility", VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for missing encryptedData", async () => {
    const res = await putJSON(createApp(), `/account/friends/${CONNECTION_ID}/visibility`, {
      version: 1,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for missing version", async () => {
    const res = await putJSON(createApp(), `/account/friends/${CONNECTION_ID}/visibility`, {
      encryptedData: "dGVzdA==" as EncryptedBase64,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for malformed JSON body", async () => {
    const res = await createApp().request(`/account/friends/${CONNECTION_ID}/visibility`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
  });
});
