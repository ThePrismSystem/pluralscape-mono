import { toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
  mockWebhookConfigServiceFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, putJSON } from "../../helpers/route-test-setup.js";

import type { WebhookConfigResult } from "../../../services/webhook-config.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-config.service.js", () => mockWebhookConfigServiceFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { updateWebhookConfig } = await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const WH_ID = "wh_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const MOCK_UPDATE_RESULT: WebhookConfigResult = {
  id: WH_ID as WebhookConfigResult["id"],
  systemId: SYS_ID as WebhookConfigResult["systemId"],
  url: "https://example.com/webhook-updated",
  eventTypes: ["member.updated"],
  enabled: true,
  cryptoKeyId: null,
  version: 2,
  archived: false,
  archivedAt: null,
  createdAt: toUnixMillis(1000),
  updatedAt: toUnixMillis(2000),
};

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:systemId/webhook-configs/:webhookId", () => {
  beforeEach(() => {
    vi.mocked(updateWebhookConfig).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated config", async () => {
    vi.mocked(updateWebhookConfig).mockResolvedValueOnce(MOCK_UPDATE_RESULT);

    const app = createApp();
    const res = await putJSON(app, `/systems/${SYS_ID}/webhook-configs/${WH_ID}`, {
      url: "https://example.com/webhook-updated",
      eventTypes: ["member.updated"],
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: WebhookConfigResult };
    expect(body.data.id).toBe(WH_ID);
    expect(body.data.url).toBe("https://example.com/webhook-updated");
    expect(body.data.version).toBe(2);
  });

  it("passes body and IDs to service function", async () => {
    vi.mocked(updateWebhookConfig).mockResolvedValueOnce(MOCK_UPDATE_RESULT);

    const app = createApp();
    await putJSON(app, `/systems/${SYS_ID}/webhook-configs/${WH_ID}`, {
      url: "https://example.com/webhook-updated",
      eventTypes: ["member.updated"],
      enabled: false,
    });

    expect(updateWebhookConfig).toHaveBeenCalledTimes(1);
    expect(updateWebhookConfig).toHaveBeenCalledWith(
      expect.anything(), // db
      SYS_ID,
      WH_ID,
      expect.objectContaining({
        url: "https://example.com/webhook-updated",
        eventTypes: ["member.updated"],
        enabled: false,
      }),
      expect.anything(), // auth
      expect.anything(), // audit
    );
  });
});
