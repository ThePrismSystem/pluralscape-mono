import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/device-token.service.js", () => ({
  registerDeviceToken: vi.fn(),
  listDeviceTokens: vi.fn(),
  revokeDeviceToken: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { registerDeviceToken, listDeviceTokens, revokeDeviceToken } =
  await import("../../../services/device-token.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYSTEM_ID}/device-tokens`;
const TOKEN_ID = "dt_660e8400-e29b-41d4-a716-446655440000";

const MOCK_TOKEN = {
  id: TOKEN_ID,
  systemId: SYSTEM_ID,
  platform: "ios",
  token: "***12345678",
  lastActiveAt: 1000,
  createdAt: 1000,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/device-tokens", () => {
  beforeEach(() => {
    vi.mocked(registerDeviceToken).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with registered token", async () => {
    vi.mocked(registerDeviceToken).mockResolvedValueOnce(MOCK_TOKEN as never);

    const res = await postJSON(createApp(), BASE_URL, {
      platform: "ios",
      token: "some-push-token-value",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as typeof MOCK_TOKEN;
    expect(body.id).toBe(TOKEN_ID);
  });

  it("passes parsed body to service", async () => {
    vi.mocked(registerDeviceToken).mockResolvedValueOnce(MOCK_TOKEN as never);

    await postJSON(createApp(), BASE_URL, {
      platform: "android",
      token: "fcm-token-value",
    });

    expect(vi.mocked(registerDeviceToken)).toHaveBeenCalledWith(
      {},
      SYSTEM_ID,
      { platform: "android", token: "fcm-token-value" },
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid body", async () => {
    const res = await postJSON(createApp(), BASE_URL, { bad: true });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for missing platform", async () => {
    const res = await postJSON(createApp(), BASE_URL, {
      token: "some-token",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid systemId prefix", async () => {
    const res = await postJSON(createApp(), "/systems/invalid-id/device-tokens", {
      platform: "ios",
      token: "test",
    });

    expect(res.status).toBe(400);
  });
});

describe("GET /systems/:systemId/device-tokens", () => {
  beforeEach(() => {
    vi.mocked(listDeviceTokens).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with token list", async () => {
    vi.mocked(listDeviceTokens).mockResolvedValueOnce([MOCK_TOKEN] as never);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: (typeof MOCK_TOKEN)[] };
    expect(body.data).toHaveLength(1);
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listDeviceTokens).mockResolvedValueOnce([]);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: never[] };
    expect(body.data).toHaveLength(0);
  });

  it("passes auth context and systemId to service", async () => {
    vi.mocked(listDeviceTokens).mockResolvedValueOnce([]);

    await createApp().request(BASE_URL);

    expect(vi.mocked(listDeviceTokens)).toHaveBeenCalledWith({}, SYSTEM_ID, MOCK_AUTH);
  });
});

describe("POST /systems/:systemId/device-tokens/:tokenId/revoke", () => {
  beforeEach(() => {
    vi.mocked(revokeDeviceToken).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(revokeDeviceToken).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`${BASE_URL}/${TOKEN_ID}/revoke`, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("passes tokenId and systemId to service", async () => {
    vi.mocked(revokeDeviceToken).mockResolvedValueOnce(undefined);

    const app = createApp();
    await app.request(`${BASE_URL}/${TOKEN_ID}/revoke`, { method: "POST" });

    expect(vi.mocked(revokeDeviceToken)).toHaveBeenCalledWith(
      {},
      SYSTEM_ID,
      TOKEN_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid tokenId prefix", async () => {
    const app = createApp();
    const res = await app.request(`${BASE_URL}/invalid-id/revoke`, { method: "POST" });

    expect(res.status).toBe(400);
  });
});
