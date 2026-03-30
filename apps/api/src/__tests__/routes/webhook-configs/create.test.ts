import { toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockWebhookConfigServiceFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { WebhookConfigCreateResult } from "../../../services/webhook-config.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-config.service.js", () => mockWebhookConfigServiceFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createWebhookConfig } = await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const WH_ID = "wh_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const MOCK_CREATE_RESULT: WebhookConfigCreateResult = {
  id: WH_ID as WebhookConfigCreateResult["id"],
  systemId: SYS_ID as WebhookConfigCreateResult["systemId"],
  url: "https://example.com/webhook",
  eventTypes: ["member.created"],
  enabled: true,
  cryptoKeyId: null,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: toUnixMillis(1000),
  updatedAt: toUnixMillis(1000),
  secret: "dGVzdC1zZWNyZXQ=",
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/webhook-configs", () => {
  beforeEach(() => {
    vi.mocked(createWebhookConfig).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with created webhook config including secret", async () => {
    vi.mocked(createWebhookConfig).mockResolvedValueOnce(MOCK_CREATE_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/webhook-configs`, {
      url: "https://example.com/webhook",
      eventTypes: ["member.created"],
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: WebhookConfigCreateResult };
    expect(body.data.id).toBe(WH_ID);
    expect(body.data.secret).toBe("dGVzdC1zZWNyZXQ=");
    expect(body.data.url).toBe("https://example.com/webhook");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes body to service", async () => {
    vi.mocked(createWebhookConfig).mockResolvedValueOnce(MOCK_CREATE_RESULT);

    const app = createApp();
    await postJSON(app, `/systems/${SYS_ID}/webhook-configs`, {
      url: "https://example.com/webhook",
      eventTypes: ["member.created", "fronting.started"],
      enabled: false,
    });

    expect(createWebhookConfig).toHaveBeenCalledTimes(1);
  });
});
