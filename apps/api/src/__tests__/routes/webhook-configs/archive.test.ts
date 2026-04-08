import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
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
  archiveWebhookConfig: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { archiveWebhookConfig } = await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const WEBHOOK_ID = "wh_660e8400-e29b-41d4-a716-446655440000";
const ARCHIVE_URL = `/systems/${SYS_ID}/webhook-configs/${WEBHOOK_ID}/archive`;

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:systemId/webhook-configs/:webhookId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveWebhookConfig).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveWebhookConfig).mockResolvedValueOnce(undefined);

    const res = await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("passes ids to service", async () => {
    vi.mocked(archiveWebhookConfig).mockResolvedValueOnce(undefined);

    await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(vi.mocked(archiveWebhookConfig)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      WEBHOOK_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(
      `/systems/not-valid/webhook-configs/${WEBHOOK_ID}/archive`,
      { method: "POST" },
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid webhookId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/webhook-configs/not-valid/archive`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    [409, "ALREADY_ARCHIVED", "Webhook config is already archived"],
    [404, "NOT_FOUND", "Webhook config not found"],
  ] as const)("maps service ApiHttpError %i %s to HTTP response", async (status, code, message) => {
    vi.mocked(archiveWebhookConfig).mockRejectedValueOnce(new ApiHttpError(status, code, message));

    const res = await createApp().request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(status);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe(code);
  });
});
