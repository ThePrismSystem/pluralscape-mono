import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, putJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/fronting-report.service.js", () => ({
  updateFrontingReport: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { updateFrontingReport } = await import("../../../services/fronting-report.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const REPORT_ID = "fr_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const UPDATE_URL = `/systems/${SYS_ID}/fronting-reports/${REPORT_ID}`;

const MOCK_UPDATE_BODY = { encryptedData: "dXBkYXRlZA==", version: 2 };

const MOCK_UPDATE_RESULT = {
  id: "fr_660e8400-e29b-41d4-a716-446655440000" as never,
  systemId: MOCK_AUTH.systemId as never,
  encryptedData: "dXBkYXRlZA==",
  format: "html" as const,
  generatedAt: 5000 as never,
  version: 2,
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
  updatedAt: 3000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

describe("PUT /systems/:systemId/fronting-reports/:reportId", () => {
  beforeEach(() => {
    vi.mocked(updateFrontingReport).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with updated report on success", async () => {
    vi.mocked(updateFrontingReport).mockResolvedValueOnce(MOCK_UPDATE_RESULT);

    const app = createApp();
    const res = await putJSON(app, UPDATE_URL, MOCK_UPDATE_BODY);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: typeof MOCK_UPDATE_RESULT };
    expect(body.data.id).toBe(REPORT_ID);
    expect(body.data.encryptedData).toBe("dXBkYXRlZA==");
    expect(body.data.version).toBe(2);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(updateFrontingReport).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Fronting report not found"),
    );

    const app = createApp();
    const res = await putJSON(app, UPDATE_URL, MOCK_UPDATE_BODY);

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("passes correct arguments to service", async () => {
    vi.mocked(updateFrontingReport).mockResolvedValueOnce(MOCK_UPDATE_RESULT);

    const app = createApp();
    await putJSON(app, UPDATE_URL, MOCK_UPDATE_BODY);

    expect(updateFrontingReport).toHaveBeenCalledTimes(1);
    expect(updateFrontingReport).toHaveBeenCalledWith(
      expect.anything(), // db
      SYS_ID,
      REPORT_ID,
      expect.objectContaining(MOCK_UPDATE_BODY),
      expect.anything(), // auth
      expect.anything(), // audit
    );
  });
});
