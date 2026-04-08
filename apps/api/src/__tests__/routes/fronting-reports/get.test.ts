import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/fronting-report.service.js", () => ({
  getFrontingReport: vi.fn(),
}));
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { getFrontingReport } = await import("../../../services/fronting-report.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const REPORT_ID = "fr_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const GET_URL = `/systems/${SYS_ID}/fronting-reports/${REPORT_ID}`;

const MOCK_RESULT = {
  id: REPORT_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  encryptedData: "dGVzdA==",
  format: "html" as const,
  generatedAt: 5000 as never,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("GET /systems/:systemId/fronting-reports/:reportId", () => {
  beforeEach(() => {
    vi.mocked(getFrontingReport).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with report", async () => {
    vi.mocked(getFrontingReport).mockResolvedValueOnce(MOCK_RESULT);

    const res = await createApp().request(GET_URL);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(REPORT_ID);
  });

  it("passes ids to service", async () => {
    vi.mocked(getFrontingReport).mockResolvedValueOnce(MOCK_RESULT);

    await createApp().request(GET_URL);

    expect(vi.mocked(getFrontingReport)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      REPORT_ID,
      expect.any(Object),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await createApp().request(`/systems/not-valid/fronting-reports/${REPORT_ID}`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid reportId format", async () => {
    const res = await createApp().request(`/systems/${SYS_ID}/fronting-reports/not-valid`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it.each([[404, "NOT_FOUND", "Fronting report not found"]] as const)(
    "maps service ApiHttpError %i %s to HTTP response",
    async (status, code, message) => {
      vi.mocked(getFrontingReport).mockRejectedValueOnce(new ApiHttpError(status, code, message));

      const res = await createApp().request(GET_URL);

      expect(res.status).toBe(status);
      const body = (await res.json()) as ApiErrorResponse;
      expect(body.error.code).toBe(code);
    },
  );
});
