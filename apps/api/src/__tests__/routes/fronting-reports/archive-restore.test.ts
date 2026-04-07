import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

vi.mock("../../../services/fronting-report.service.js", () => ({
  archiveFrontingReport: vi.fn(),
  restoreFrontingReport: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());
const { archiveFrontingReport, restoreFrontingReport } =
  await import("../../../services/fronting-report.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

const createApp = () => createRouteApp("/systems", systemRoutes);

const ARCHIVE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/fronting-reports/fr_660e8400-e29b-41d4-a716-446655440000/archive";
const RESTORE_URL =
  "/systems/sys_550e8400-e29b-41d4-a716-446655440000/fronting-reports/fr_660e8400-e29b-41d4-a716-446655440000/restore";

describe("POST /systems/:id/fronting-reports/:reportId/archive", () => {
  beforeEach(() => {
    vi.mocked(archiveFrontingReport).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(archiveFrontingReport).mockResolvedValueOnce(undefined);

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveFrontingReport).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Fronting report not found"),
    );

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when already archived", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(archiveFrontingReport).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Fronting report is already archived"),
    );

    const app = createApp();
    const res = await app.request(ARCHIVE_URL, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("ALREADY_ARCHIVED");
  });
});

describe("POST /systems/:id/fronting-reports/:reportId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreFrontingReport).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored fronting report", async () => {
    vi.mocked(restoreFrontingReport).mockResolvedValueOnce({
      id: "fr_660e8400-e29b-41d4-a716-446655440000" as never,
      systemId: MOCK_AUTH.systemId as never,
      encryptedData: "dGVzdA==",
      format: "html" as const,
      generatedAt: 5000 as never,
      version: 2,
      archived: false,
      archivedAt: null,
      createdAt: 1000 as never,
      updatedAt: 2000 as never,
    });

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(2);
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreFrontingReport).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Archived fronting report not found"),
    );

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when not archived", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreFrontingReport).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Fronting report is not archived"),
    );

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_ARCHIVED");
  });
});
