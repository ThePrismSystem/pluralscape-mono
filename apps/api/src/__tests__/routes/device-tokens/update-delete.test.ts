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

vi.mock("../../../services/device-token/register.js", () => ({
  registerDeviceToken: vi.fn(),
}));

vi.mock("../../../services/device-token/update.js", () => ({
  updateDeviceToken: vi.fn(),
}));

vi.mock("../../../services/device-token/delete.js", () => ({
  deleteDeviceToken: vi.fn(),
}));

vi.mock("../../../services/device-token/revoke.js", () => ({
  revokeDeviceToken: vi.fn(),
}));

vi.mock("../../../services/device-token/queries.js", () => ({
  listDeviceTokens: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { updateDeviceToken } = await import("../../../services/device-token/update.js");
const { deleteDeviceToken } = await import("../../../services/device-token/delete.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const TOKEN_ID = "dt_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const TOKEN_URL = `/systems/${SYS_ID}/device-tokens/${TOKEN_ID}`;

const MOCK_TOKEN = {
  id: TOKEN_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  platform: "ios" as const,
  tokenHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
  lastActiveAt: 2000 as never,
  createdAt: 1000 as never,
};

// ── Update Tests ────────────────────────────────────────────────

describe("PUT /systems/:id/device-tokens/:tokenId", () => {
  beforeEach(() => vi.mocked(updateDeviceToken).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 on success", async () => {
    vi.mocked(updateDeviceToken).mockResolvedValueOnce(MOCK_TOKEN);
    const app = createApp();
    const res = await putJSON(app, TOKEN_URL, { platform: "ios" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(TOKEN_ID);
  });

  it("returns 400 when body has no updatable fields", async () => {
    const app = createApp();
    const res = await putJSON(app, TOKEN_URL, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateDeviceToken).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Device token not found"),
    );
    const app = createApp();
    const res = await putJSON(app, TOKEN_URL, { platform: "android" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for invalid ID format", async () => {
    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/device-tokens/not-valid`, {
      platform: "ios",
    });
    expect(res.status).toBe(400);
  });
});

// ── Delete Tests ────────────────────────────────────────────────

describe("DELETE /systems/:id/device-tokens/:tokenId", () => {
  beforeEach(() => vi.mocked(deleteDeviceToken).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(deleteDeviceToken).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(TOKEN_URL, { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(deleteDeviceToken).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Device token not found"),
    );
    const app = createApp();
    const res = await app.request(TOKEN_URL, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("forwards systemId, tokenId, auth to service", async () => {
    vi.mocked(deleteDeviceToken).mockResolvedValueOnce(undefined);
    const app = createApp();
    await app.request(TOKEN_URL, { method: "DELETE" });
    expect(vi.mocked(deleteDeviceToken)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      TOKEN_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid ID format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/device-tokens/not-valid`, {
      method: "DELETE",
    });
    expect(res.status).toBe(400);
  });
});
