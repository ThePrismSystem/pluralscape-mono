import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HTTP_CONFLICT, HTTP_NOT_FOUND } from "../../../http.constants.js";
import { ApiHttpError } from "../../../lib/api-error.js";
import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockWebhookConfigServiceFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/webhook-config.service.js", () => mockWebhookConfigServiceFactory());

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { deleteWebhookConfig } = await import("../../../services/webhook-config.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const WH_ID = "wh_550e8400-e29b-41d4-a716-446655440001";

const createApp = () => createRouteApp("/systems", systemRoutes);

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:systemId/webhook-configs/:webhookId", () => {
  beforeEach(() => {
    vi.mocked(deleteWebhookConfig).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on successful delete", async () => {
    vi.mocked(deleteWebhookConfig).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/webhook-configs/${WH_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("returns 409 when pending deliveries exist", async () => {
    vi.mocked(deleteWebhookConfig).mockRejectedValueOnce(
      new ApiHttpError(
        HTTP_CONFLICT,
        "HAS_DEPENDENTS",
        "Webhook config has 3 pending delivery(ies).",
      ),
    );

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/webhook-configs/${WH_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("HAS_DEPENDENTS");
  });

  it("returns 404 when config not found", async () => {
    vi.mocked(deleteWebhookConfig).mockRejectedValueOnce(
      new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Webhook config not found"),
    );

    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/webhook-configs/${WH_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});
