import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-delivery.service.js", () => ({
  getWebhookDelivery: vi.fn(),
}));
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getWebhookDelivery } = await import("../../../services/webhook-delivery.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const DELIVERY_ID = "wd_660e8400-e29b-41d4-a716-446655440000";
const WEBHOOK_ID = "wh_770e8400-e29b-41d4-a716-446655440000";
const GET_URL = `/systems/${SYS_ID}/webhook-deliveries/${DELIVERY_ID}`;

const MOCK_RESULT = {
  id: DELIVERY_ID as never,
  webhookId: WEBHOOK_ID as never,
  systemId: SYS_ID as never,
  eventType: "fronting.started" as const,
  status: "success" as const,
  httpStatus: 200,
  attemptCount: 1,
  lastAttemptAt: 1000 as never,
  nextRetryAt: null,
  createdAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/webhook-deliveries/:deliveryId", () => {
  beforeEach(() => {
    vi.mocked(getWebhookDelivery).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with delivery", async () => {
    vi.mocked(getWebhookDelivery).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(GET_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(DELIVERY_ID);
  });

  it("passes ids to service", async () => {
    vi.mocked(getWebhookDelivery).mockResolvedValueOnce(MOCK_RESULT);

    await createApp().request(GET_URL);

    expect(vi.mocked(getWebhookDelivery)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      DELIVERY_ID,
      expect.any(Object),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/webhook-deliveries/${DELIVERY_ID}`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid deliveryId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/webhook-deliveries/not-valid`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
