import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAccountOnlyAuthFactory,
  mockAuditWriterFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/account-pin.service.js", () => ({
  setAccountPin: vi.fn(),
  removeAccountPin: vi.fn(),
  verifyAccountPin: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAccountOnlyAuthFactory());
// Also mock services used by other account routes to prevent import errors
vi.mock("../../../services/account.service.js", () => ({
  getAccountInfo: vi.fn(),
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  updateAccountSettings: vi.fn(),
  ConcurrencyError: class ConcurrencyError extends Error {},
}));

vi.mock("../../../services/account-delete.service.js", () => ({
  deleteAccount: vi.fn(),
  purgeAccount: vi.fn(),
}));

vi.mock("../../../services/friend-code.service.js", () => ({
  createFriendCode: vi.fn(),
  listFriendCodes: vi.fn(),
  redeemFriendCode: vi.fn(),
  revokeFriendCode: vi.fn(),
}));

vi.mock("../../../services/friend-connection/lifecycle.js", () => ({
  archiveFriendConnection: vi.fn(),
  restoreFriendConnection: vi.fn(),
}));
vi.mock("../../../services/friend-connection/queries.js", () => ({
  getFriendConnection: vi.fn(),
  listFriendConnections: vi.fn(),
}));
vi.mock("../../../services/friend-connection/transitions.js", () => ({
  acceptFriendConnection: vi.fn(),
  blockFriendConnection: vi.fn(),
  rejectFriendConnection: vi.fn(),
  removeFriendConnection: vi.fn(),
}));
vi.mock("../../../services/friend-connection/update.js", () => ({
  updateFriendVisibility: vi.fn(),
}));

vi.mock("../../../services/friend-request.service.js", () => ({
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
}));

vi.mock("../../../services/friend-dashboard.service.js", () => ({
  getFriendDashboard: vi.fn(),
}));

vi.mock("../../../services/friend-dashboard-sync.service.js", () => ({
  getFriendDashboardSync: vi.fn(),
}));

vi.mock("../../../services/friend-export.service.js", () => ({
  getFriendExportManifest: vi.fn(),
  getFriendExportPage: vi.fn(),
}));

vi.mock("../../../services/friend-notification-preference.service.js", () => ({
  getFriendNotificationPreference: vi.fn(),
  upsertFriendNotificationPreference: vi.fn(),
}));

vi.mock("../../../services/device-transfer.service.js", () => ({
  initiateDeviceTransfer: vi.fn(),
  approveDeviceTransfer: vi.fn(),
  completeDeviceTransfer: vi.fn(),
  cancelDeviceTransfer: vi.fn(),
  getDeviceTransferStatus: vi.fn(),
}));

vi.mock("../../../services/audit-log.service.js", () => ({
  getAuditLog: vi.fn(),
}));

// ── Imports after mocks ──────────────────────────────────────────

const { setAccountPin, removeAccountPin, verifyAccountPin } =
  await import("../../../services/account-pin.service.js");
const { accountRoutes } = await import("../../../routes/account/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/account", accountRoutes);

async function deleteJSON(app: Hono, path: string, body: unknown): Promise<Response> {
  return await app.request(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────

describe("POST /account/pin", () => {
  beforeEach(() => {
    vi.mocked(setAccountPin).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 with no body", async () => {
    vi.mocked(setAccountPin).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await postJSON(app, "/account/pin", { pin: "1234" });

    expect(res.status).toBe(204);
    expect(res.headers.get("content-length")).toBeNull();
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/account/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(setAccountPin).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, "/account/pin", { pin: "1234" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("DELETE /account/pin", () => {
  beforeEach(() => {
    vi.mocked(removeAccountPin).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 with no body", async () => {
    vi.mocked(removeAccountPin).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await deleteJSON(app, "/account/pin", { pin: "1234" });

    expect(res.status).toBe(204);
    expect(res.headers.get("content-length")).toBeNull();
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/account/pin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(removeAccountPin).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await deleteJSON(app, "/account/pin", { pin: "1234" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /account/pin/verify", () => {
  beforeEach(() => {
    vi.mocked(verifyAccountPin).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with result on success", async () => {
    vi.mocked(verifyAccountPin).mockResolvedValueOnce({ verified: true });

    const app = createApp();
    const res = await postJSON(app, "/account/pin/verify", { pin: "1234" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { verified: boolean } };
    expect(body.data.verified).toBe(true);
  });

  it("returns 400 VALIDATION_ERROR for malformed JSON body", async () => {
    const app = createApp();
    const res = await app.request("/account/pin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("re-throws unexpected errors", async () => {
    vi.mocked(verifyAccountPin).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const app = createApp();
    const res = await postJSON(app, "/account/pin/verify", { pin: "1234" });

    expect(res.status).toBe(500);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
