import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { FrontingReportId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/fronting-report.service.js", () => ({
  createFrontingReport: vi.fn(),
  getFrontingReport: vi.fn(),
  listFrontingReports: vi.fn(),
  updateFrontingReport: vi.fn(),
  archiveFrontingReport: vi.fn(),
  restoreFrontingReport: vi.fn(),
}));

const {
  createFrontingReport,
  getFrontingReport,
  listFrontingReports,
  updateFrontingReport,
  archiveFrontingReport,
  restoreFrontingReport,
} = await import("../../../services/fronting-report.service.js");

const { frontingReportRouter } = await import("../../../trpc/routers/fronting-report.js");

const createCaller = makeCallerFactory({ frontingReport: frontingReportRouter });

const REPORT_ID = "fr_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as FrontingReportId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

const MOCK_REPORT_RESULT = {
  id: REPORT_ID,
  systemId: SYSTEM_ID,
  encryptedData: "base64data==",
  format: "html" as const,
  generatedAt: 1_700_000_000_000 as UnixMillis,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("frontingReport router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("frontingReport.create", () => {
    it("calls createFrontingReport with correct systemId and returns result", async () => {
      vi.mocked(createFrontingReport).mockResolvedValue(MOCK_REPORT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingReport.create({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        format: "html",
        generatedAt: 1_700_000_000_000,
      });

      expect(vi.mocked(createFrontingReport)).toHaveBeenCalledOnce();
      expect(vi.mocked(createFrontingReport).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_REPORT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.frontingReport.create({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          format: "html",
          generatedAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.frontingReport.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          format: "html",
          generatedAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("rejects invalid format value", async () => {
      const caller = createCaller();
      await expect(
        caller.frontingReport.create({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          format: "docx" as "html",
          generatedAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("frontingReport.get", () => {
    it("calls getFrontingReport with correct systemId and reportId", async () => {
      vi.mocked(getFrontingReport).mockResolvedValue(MOCK_REPORT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingReport.get({
        systemId: SYSTEM_ID,
        reportId: REPORT_ID,
      });

      expect(vi.mocked(getFrontingReport)).toHaveBeenCalledOnce();
      expect(vi.mocked(getFrontingReport).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getFrontingReport).mock.calls[0]?.[2]).toBe(REPORT_ID);
      expect(result).toEqual(MOCK_REPORT_RESULT);
    });

    it("rejects invalid reportId format", async () => {
      const caller = createCaller();
      await expect(
        caller.frontingReport.get({
          systemId: SYSTEM_ID,
          reportId: "not-a-report-id" as FrontingReportId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("frontingReport.list", () => {
    it("calls listFrontingReports and returns paginated result", async () => {
      const mockList = {
        data: [MOCK_REPORT_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listFrontingReports).mockResolvedValue(mockList);
      const caller = createCaller();
      const result = await caller.frontingReport.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listFrontingReports)).toHaveBeenCalledOnce();
      expect(result).toEqual(mockList);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("frontingReport.update", () => {
    it("calls updateFrontingReport with correct reportId", async () => {
      vi.mocked(updateFrontingReport).mockResolvedValue(MOCK_REPORT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingReport.update({
        systemId: SYSTEM_ID,
        reportId: REPORT_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateFrontingReport)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateFrontingReport).mock.calls[0]?.[2]).toBe(REPORT_ID);
      expect(result).toEqual(MOCK_REPORT_RESULT);
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("frontingReport.archive", () => {
    it("calls archiveFrontingReport and returns success", async () => {
      vi.mocked(archiveFrontingReport).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.frontingReport.archive({
        systemId: SYSTEM_ID,
        reportId: REPORT_ID,
      });

      expect(vi.mocked(archiveFrontingReport)).toHaveBeenCalledOnce();
      expect(result).toEqual({ success: true });
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("frontingReport.restore", () => {
    it("calls restoreFrontingReport and returns result", async () => {
      vi.mocked(restoreFrontingReport).mockResolvedValue(MOCK_REPORT_RESULT);
      const caller = createCaller();
      const result = await caller.frontingReport.restore({
        systemId: SYSTEM_ID,
        reportId: REPORT_ID,
      });

      expect(vi.mocked(restoreFrontingReport)).toHaveBeenCalledOnce();
      expect(result).toEqual(MOCK_REPORT_RESULT);
    });
  });

  // ── error mapping ────────────────────────────────────────────────

  describe("error mapping", () => {
    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getFrontingReport).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Fronting report not found"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingReport.get({ systemId: SYSTEM_ID, reportId: REPORT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateFrontingReport).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingReport.update({
          systemId: SYSTEM_ID,
          reportId: REPORT_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(listFrontingReports).mockResolvedValue({ items: [], nextCursor: null });
    const caller = createCaller();
    await caller.frontingReport.list({ systemId: SYSTEM_ID });
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalled();
    const callKey = vi.mocked(checkRateLimit).mock.calls[0]?.[0] as string;
    expect(callKey).toContain("readDefault");
  });
});
