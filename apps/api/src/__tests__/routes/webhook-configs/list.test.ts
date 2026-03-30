import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockWebhookConfigServiceFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { WebhookConfigResult } from "../../../services/webhook-config.service.js";
import type { PaginatedResult } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-config.service.js", () => mockWebhookConfigServiceFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { listWebhookConfigs } = await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const EMPTY_PAGE: PaginatedResult<WebhookConfigResult> = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/webhook-configs", () => {
  beforeEach(() => {
    vi.mocked(listWebhookConfigs).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with empty list when no configs exist", async () => {
    vi.mocked(listWebhookConfigs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/webhook-configs`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as PaginatedResult<WebhookConfigResult>;
    expect(body.data).toEqual([]);
    expect(body.hasMore).toBe(false);
  });

  it("passes pagination params to service", async () => {
    vi.mocked(listWebhookConfigs).mockResolvedValueOnce(EMPTY_PAGE);

    const app = createApp();
    await app.request(`/systems/${SYS_ID}/webhook-configs?limit=10`);

    expect(listWebhookConfigs).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(listWebhookConfigs).mock.calls[0];
    expect(callArgs?.[3]?.limit).toBe(10);
  });
});
