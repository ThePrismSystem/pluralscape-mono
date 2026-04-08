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

vi.mock("../../../services/fronting-report.service.js", () => ({
  deleteFrontingReport: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { deleteFrontingReport } = await import("../../../services/fronting-report.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const REPORT_ID = "fr_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const DELETE_URL = `/systems/${SYS_ID}/fronting-reports/${REPORT_ID}`;

// ── Tests ────────────────────────────────────────────────────────

describe("DELETE /systems/:systemId/fronting-reports/:reportId", () => {
  beforeEach(() => {
    vi.mocked(deleteFrontingReport).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteFrontingReport).mockResolvedValueOnce(undefined);

    const res = await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("passes ids to service", async () => {
    vi.mocked(deleteFrontingReport).mockResolvedValueOnce(undefined);

    await createApp().request(DELETE_URL, { method: "DELETE" });

    expect(vi.mocked(deleteFrontingReport)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      REPORT_ID,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/fronting-reports/${REPORT_ID}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid reportId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/fronting-reports/not-valid`, {
      method: "DELETE",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([[404, "NOT_FOUND", "Fronting report not found"]] as const)(
    "maps service ApiHttpError %i %s to HTTP response",
    async (status, code, message) => {
      vi.mocked(deleteFrontingReport).mockRejectedValueOnce(
        new ApiHttpError(status, code, message),
      );

      const res = await createApp().request(DELETE_URL, { method: "DELETE" });

      expect(res.status).toBe(status);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe(code);
    },
  );
});
