import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockWebhookConfigServiceFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { WebhookTestResult } from "../../../services/webhook-config.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-config.service.js", () => mockWebhookConfigServiceFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { testWebhookConfig } = await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const WH_ID = "wh_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const MOCK_TEST_RESULT: WebhookTestResult = {
  success: true,
  httpStatus: 200,
  error: null,
  durationMs: 150,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/webhook-configs/:webhookId/test", () => {
  beforeEach(() => {
    vi.mocked(testWebhookConfig).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with test result", async () => {
    vi.mocked(testWebhookConfig).mockResolvedValueOnce(MOCK_TEST_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/webhook-configs/${WH_ID}/test`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: WebhookTestResult };
    expect(body.data.success).toBe(true);
    expect(body.data.httpStatus).toBe(200);
  });

  it("calls service with correct parameters", async () => {
    vi.mocked(testWebhookConfig).mockResolvedValueOnce(MOCK_TEST_RESULT);

    const app = createApp();
    await postJSON(app, `/systems/${SYS_ID}/webhook-configs/${WH_ID}/test`, {});

    expect(testWebhookConfig).toHaveBeenCalledTimes(1);
  });

  it("returns failure result from service", async () => {
    const failResult: WebhookTestResult = {
      success: false,
      httpStatus: 500,
      error: null,
      durationMs: 50,
    };
    vi.mocked(testWebhookConfig).mockResolvedValueOnce(failResult);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/webhook-configs/${WH_ID}/test`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: WebhookTestResult };
    expect(body.data.success).toBe(false);
    expect(body.data.httpStatus).toBe(500);
  });
});
