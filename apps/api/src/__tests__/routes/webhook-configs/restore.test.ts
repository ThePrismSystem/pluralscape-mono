import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-config.service.js", () => ({
  restoreWebhookConfig: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { restoreWebhookConfig } = await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const WEBHOOK_ID = "wh_660e8400-e29b-41d4-a716-446655440000";
const RESTORE_URL = `/systems/${SYS_ID}/webhook-configs/${WEBHOOK_ID}/restore`;

const MOCK_RESULT = {
  id: WEBHOOK_ID as never,
  systemId: SYS_ID as never,
  url: "https://example.com/hook",
  eventTypes: ["fronting.started"] as const,
  enabled: true,
  archived: false as const,
  archivedAt: null,
  cryptoKeyId: null,
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/webhook-configs/:webhookId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreWebhookConfig).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored webhook", async () => {
    vi.mocked(restoreWebhookConfig).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(WEBHOOK_ID);
  });

  it("passes ids to service", async () => {
    vi.mocked(restoreWebhookConfig).mockResolvedValueOnce(MOCK_RESULT);

    await createApp().request(RESTORE_URL, { method: "POST" });

    expect(vi.mocked(restoreWebhookConfig)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      WEBHOOK_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(
      `/systems/not-valid/webhook-configs/${WEBHOOK_ID}/restore`,
      { method: "POST" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid webhookId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/webhook-configs/not-valid/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
