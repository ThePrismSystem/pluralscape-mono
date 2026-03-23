import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockWebhookConfigServiceFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { WebhookDeliveryResult } from "../../../services/webhook-delivery.service.js";
import type { PaginatedResult } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-delivery.service.js", () => ({
  listWebhookDeliveries: vi.fn(),
  getWebhookDelivery: vi.fn(),
  deleteWebhookDelivery: vi.fn(),
  parseWebhookDeliveryQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../services/webhook-config.service.js", () => mockWebhookConfigServiceFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listWebhookDeliveries } = await import("../../../services/webhook-delivery.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const EMPTY_PAGE: PaginatedResult<WebhookDeliveryResult> = {
  items: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/webhook-deliveries", () => {
  beforeEach(() => {
    vi.mocked(listWebhookDeliveries).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list", async () => {
    vi.mocked(listWebhookDeliveries).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/webhook-deliveries`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<WebhookDeliveryResult>;
    expect(body.items).toEqual([]);
    expect(body.hasMore).toBe(false);
  });
});
