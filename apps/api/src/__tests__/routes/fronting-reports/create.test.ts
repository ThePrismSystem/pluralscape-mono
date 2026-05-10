import { brandId, toUnixMillis } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_SYSTEM_ID, createRouteApp, postJSON } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse, EncryptedBase64, FrontingReportId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/fronting-report/create.js", () => ({
  createFrontingReport: vi.fn(),
}));
vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { createFrontingReport } = await import("../../../services/fronting-report/create.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const REPORT_ID = "fr_660e8400-e29b-41d4-a716-446655440000";

const createApp = () => createRouteApp("/systems", systemRoutes);

const CREATE_URL = `/systems/${SYS_ID}/fronting-reports`;

const VALID_BODY = {
  encryptedData: "dGVzdA==" as EncryptedBase64,
  format: "html" as const,
  generatedAt: 5000,
};

const MOCK_RESULT = {
  id: brandId<FrontingReportId>(REPORT_ID),
  systemId: MOCK_SYSTEM_ID,
  encryptedData: "dGVzdA==" as EncryptedBase64,
  format: "html" as const,
  generatedAt: toUnixMillis(5000),
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: toUnixMillis(1000),
  updatedAt: toUnixMillis(1000),
};

// ── Tests ────────────────────────────────────────────────────────

// No error-mapping cases — createFrontingReport does not throw ApiHttpError.
describe("POST /systems/:systemId/fronting-reports", () => {
  beforeEach(() => {
    vi.mocked(createFrontingReport).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 201 with created report", async () => {
    vi.mocked(createFrontingReport).mockResolvedValueOnce(MOCK_RESULT);

    const res = await postJSON(createApp(), CREATE_URL, VALID_BODY);

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(REPORT_ID);
  });

  it("passes body and systemId to service", async () => {
    vi.mocked(createFrontingReport).mockResolvedValueOnce(MOCK_RESULT);

    await postJSON(createApp(), CREATE_URL, VALID_BODY);

    expect(vi.mocked(createFrontingReport)).toHaveBeenCalledWith(
      {},
      SYS_ID,
      VALID_BODY,
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("returns 400 for invalid systemId format", async () => {
    const res = await postJSON(createApp(), `/systems/not-valid/fronting-reports`, VALID_BODY);

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await createApp().request(CREATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
