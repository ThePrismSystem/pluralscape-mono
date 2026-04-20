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

const { rotateWebhookSecret, toServerSecret } =
  await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const WH_ID = "wh_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

const MOCK_ROTATE_RESULT: WebhookConfigCreateResult = {
  id: WH_ID as WebhookConfigCreateResult["id"],
  systemId: SYS_ID as WebhookConfigCreateResult["systemId"],
  url: "https://example.com/webhook",
  eventTypes: ["member.created"],
  enabled: true,
  cryptoKeyId: null,
  version: 2,
  archived: false,
  archivedAt: null,
  createdAt: toUnixMillis(1000),
  updatedAt: toUnixMillis(2000),
  secret: "bmV3LXNlY3JldC1rZXk=",
  secretBytes: toServerSecret(Buffer.from("new-secret-key")),
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/webhook-configs/:webhookId/rotate-secret", () => {
  beforeEach(() => {
    vi.mocked(rotateWebhookSecret).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with rotated secret", async () => {
    vi.mocked(rotateWebhookSecret).mockResolvedValueOnce(MOCK_ROTATE_RESULT);

    const app = createApp();
    const res = await postJSON(app, `/systems/${SYS_ID}/webhook-configs/${WH_ID}/rotate-secret`, {
      version: 1,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: WebhookConfigCreateResult };
    expect(body.data.id).toBe(WH_ID);
    expect(body.data.secret).toBe("bmV3LXNlY3JldC1rZXk=");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("passes body to service", async () => {
    vi.mocked(rotateWebhookSecret).mockResolvedValueOnce(MOCK_ROTATE_RESULT);

    const app = createApp();
    await postJSON(app, `/systems/${SYS_ID}/webhook-configs/${WH_ID}/rotate-secret`, {
      version: 1,
    });

    expect(rotateWebhookSecret).toHaveBeenCalledTimes(1);
  });
});
