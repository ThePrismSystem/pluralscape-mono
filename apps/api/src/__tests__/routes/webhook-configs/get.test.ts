import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { WebhookConfigResult } from "../../../services/webhook-config.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-config.service.js", () => ({
  createWebhookConfig: vi.fn(),
  listWebhookConfigs: vi.fn(),
  getWebhookConfig: vi.fn(),
  updateWebhookConfig: vi.fn(),
  deleteWebhookConfig: vi.fn(),
  archiveWebhookConfig: vi.fn(),
  restoreWebhookConfig: vi.fn(),
  parseWebhookConfigQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getWebhookConfig } = await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const WH_ID = "wh_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const MOCK_CONFIG: WebhookConfigResult = {
  id: WH_ID as WebhookConfigResult["id"],
  systemId: SYS_ID as WebhookConfigResult["systemId"],
  url: "https://example.com/webhook",
  eventTypes: ["member.created"],
  enabled: true,
  cryptoKeyId: null,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000,
  updatedAt: 1000,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/webhook-configs/:webhookId", () => {
  beforeEach(() => {
    vi.mocked(getWebhookConfig).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with the config (no secret)", async () => {
    vi.mocked(getWebhookConfig).mockResolvedValueOnce(MOCK_CONFIG);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/webhook-configs/${WH_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as WebhookConfigResult;
    expect(body.id).toBe(WH_ID);
    expect(body.url).toBe("https://example.com/webhook");
    expect(body).not.toHaveProperty("secret");
  });

  it("returns 400 for invalid webhook ID format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/webhook-configs/bad-id`);

    expect(res.status).toBe(400);
  });
});
