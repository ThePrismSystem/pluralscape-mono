import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
} from "../../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp } from "../../helpers/route-test-setup.js";

import type { ApiErrorResponse } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/check-in-record.service.js", () => ({
  createCheckInRecord: vi.fn(),
  listCheckInRecords: vi.fn(),
  getCheckInRecord: vi.fn(),
  respondCheckInRecord: vi.fn(),
  dismissCheckInRecord: vi.fn(),
  archiveCheckInRecord: vi.fn(),
  restoreCheckInRecord: vi.fn(),
  deleteCheckInRecord: vi.fn(),
  parseCheckInRecordQuery: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../../lib/db.js", () => mockDbFactory());

vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const { restoreCheckInRecord } = await import("../../../services/check-in-record.service.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const RECORD_ID = "cir_660e8400-e29b-41d4-a716-446655440000";
const RESTORE_URL = `/systems/${SYS_ID}/check-in-records/${RECORD_ID}/restore`;

const MOCK_RECORD = {
  id: RECORD_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  timerConfigId: "tmr_770e8400-e29b-41d4-a716-446655440000" as never,
  scheduledAt: 1000 as never,
  status: "pending" as const,
  respondedByMemberId: null,
  respondedAt: null,
  dismissed: false as const,
  encryptedData: null,
  archived: false,
  archivedAt: null,
};

// ── Tests ────────────────────────────────────────────────────────

describe("POST /systems/:id/check-in-records/:recordId/restore", () => {
  beforeEach(() => {
    vi.mocked(restoreCheckInRecord).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with restored record", async () => {
    vi.mocked(restoreCheckInRecord).mockResolvedValueOnce(MOCK_RECORD);

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(RECORD_ID);
  });

  it("forwards systemId, recordId, auth to service", async () => {
    vi.mocked(restoreCheckInRecord).mockResolvedValueOnce(MOCK_RECORD);

    const app = createApp();
    await app.request(RESTORE_URL, { method: "POST" });

    expect(vi.mocked(restoreCheckInRecord)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      RECORD_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 404 when not found", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Check-in record not found"),
    );

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 when not archived", async () => {
    const { ApiHttpError } = await import("../../../lib/api-error.js");
    vi.mocked(restoreCheckInRecord).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Check-in record is not archived"),
    );

    const app = createApp();
    const res = await app.request(RESTORE_URL, { method: "POST" });

    expect(res.status).toBe(409);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_ARCHIVED");
  });

  it("returns 400 for invalid ID format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/check-in-records/not-valid/restore`, {
      method: "POST",
    });

    expect(res.status).toBe(400);
  });
});
