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

vi.mock("../../../services/webhook-delivery.service.js", () => ({
  deleteWebhookDelivery: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { deleteWebhookDelivery } = await import("../../../services/webhook-delivery.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const DELIVERY_ID = "wd_660e8400-e29b-41d4-a716-446655440000";
const DELETE_URL = `/systems/${SYS_ID}/webhook-deliveries/${DELIVERY_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:systemId/webhook-deliveries/:deliveryId", () => {
  beforeEach(() => {
    vi.mocked(deleteWebhookDelivery).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteWebhookDelivery).mockResolvedValueOnce(undefined);

    const res = await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("passes ids to service", async () => {
    vi.mocked(deleteWebhookDelivery).mockResolvedValueOnce(undefined);

    await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(vi.mocked(deleteWebhookDelivery)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      DELIVERY_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/webhook-deliveries/${DELIVERY_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid deliveryId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/webhook-deliveries/not-valid`, {
      method: "DELETE",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([[404, "NOT_FOUND", "Webhook delivery not found"]] as const)(
    "maps service ApiHttpError %i %s to HTTP response",
    async (status, code, message) => {
      vi.mocked(deleteWebhookDelivery).mockRejectedValueOnce(
        new ApiHttpError(status, code, message),
      );

      const res = await createApp().request(DELETE_URL, { method: "DELETE" });

      expect(res.status).toBe(status);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe(code);
    },
  );
});
