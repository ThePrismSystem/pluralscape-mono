import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, patchJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/notification-config.service.js", () => ({
  listNotificationConfigs: vi.fn(),
  getOrCreateNotificationConfig: vi.fn(),
  updateNotificationConfig: vi.fn(),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listNotificationConfigs, updateNotificationConfig } =
  await import("../../../services/notification-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const BASE_URL = `/systems/${SYSTEM_ID}/notification-configs`;

const MOCK_CONFIG = {
  id: "ncfg_660e8400-e29b-41d4-a716-446655440000",
  systemId: SYSTEM_ID,
  eventType: "switch-reminder",
  enabled: true,
  pushEnabled: true,
  createdAt: 1000,
  updatedAt: 1000,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/notification-configs", () => {
  beforeEach(() => {
    vi.mocked(listNotificationConfigs).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with config list", async () => {
    vi.mocked(listNotificationConfigs).mockResolvedValueOnce([MOCK_CONFIG] as never);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: (typeof MOCK_CONFIG)[] };
    expect(body.data).toHaveLength(1);
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listNotificationConfigs).mockResolvedValueOnce([]);

    const res = await createApp().request(BASE_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: never[] };
    expect(body.data).toHaveLength(0);
  });

  it("passes auth context and systemId to service", async () => {
    vi.mocked(listNotificationConfigs).mockResolvedValueOnce([]);

    await createApp().request(BASE_URL);

    expect(vi.mocked(listNotificationConfigs)).toHaveBeenCalledWith({}, SYSTEM_ID, MOCK_AUTH);
  });
});

describe("PATCH /systems/:systemId/notification-configs/:eventType", () => {
  beforeEach(() => {
    vi.mocked(updateNotificationConfig).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated config", async () => {
    vi.mocked(updateNotificationConfig).mockResolvedValueOnce({
      ...MOCK_CONFIG,
      enabled: false,
    } as never);

    const res = await patchJSON(createApp(), `${BASE_URL}/switch-reminder`, {
      enabled: false,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof MOCK_CONFIG;
    expect(body.enabled).toBe(false);
  });

  it("passes eventType and params to service", async () => {
    vi.mocked(updateNotificationConfig).mockResolvedValueOnce(MOCK_CONFIG as never);

    await patchJSON(createApp(), `${BASE_URL}/switch-reminder`, {
      enabled: false,
      pushEnabled: true,
    });

    expect(vi.mocked(updateNotificationConfig)).toHaveBeenCalledWith(
      {},
      SYSTEM_ID,
      "switch-reminder",
      { enabled: false, pushEnabled: true },
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid event type", async () => {
    const res = await patchJSON(createApp(), `${BASE_URL}/invalid_event_type`, {
      enabled: false,
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid body", async () => {
    const res = await patchJSON(createApp(), `${BASE_URL}/switch-reminder`, {
      enabled: "not-a-boolean",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
