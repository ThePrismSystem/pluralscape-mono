import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { EncryptedBase64, FrontingReportId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/fronting-report/create.js", () => ({
  createFrontingReport: vi.fn(),
}));
vi.mock("../../../services/fronting-report/queries.js", () => ({
  getFrontingReport: vi.fn(),
  listFrontingReports: vi.fn(),
}));
vi.mock("../../../services/fronting-report/update.js", () => ({
  updateFrontingReport: vi.fn(),
}));
vi.mock("../../../services/fronting-report/delete.js", () => ({
  deleteFrontingReport: vi.fn(),
}));
vi.mock("../../../services/fronting-report/lifecycle.js", () => ({
  archiveFrontingReport: vi.fn(),
  restoreFrontingReport: vi.fn(),
}));

const { createFrontingReport } = await import("../../../services/fronting-report/create.js");
const { getFrontingReport, listFrontingReports } =
  await import("../../../services/fronting-report/queries.js");
const { updateFrontingReport } = await import("../../../services/fronting-report/update.js");
const { archiveFrontingReport, restoreFrontingReport } =
  await import("../../../services/fronting-report/lifecycle.js");

const { frontingReportRouter } = await import("../../../trpc/routers/fronting-report.js");

const createCaller = makeCallerFactory({ frontingReport: frontingReportRouter });

const REPORT_ID = brandId<FrontingReportId>("fr_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";

const MOCK_REPORT_RESULT = {
  id: REPORT_ID,
  systemId: MOCK_SYSTEM_ID,
  encryptedData: "base64data==" as EncryptedBase64,
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
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        format: "html",
        generatedAt: 1_700_000_000_000,
      });

      expect(vi.mocked(createFrontingReport)).toHaveBeenCalledOnce();
      expect(vi.mocked(createFrontingReport).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_REPORT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.frontingReport.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          format: "html",
          generatedAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
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
          systemId: MOCK_SYSTEM_ID,
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
        systemId: MOCK_SYSTEM_ID,
        reportId: REPORT_ID,
      });

      expect(vi.mocked(getFrontingReport)).toHaveBeenCalledOnce();
      expect(vi.mocked(getFrontingReport).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getFrontingReport).mock.calls[0]?.[2]).toBe(REPORT_ID);
      expect(result).toEqual(MOCK_REPORT_RESULT);
    });

    it("rejects invalid reportId format", async () => {
      const caller = createCaller();
      await expect(
        caller.frontingReport.get({
          systemId: MOCK_SYSTEM_ID,
          reportId: brandId<FrontingReportId>("not-a-report-id"),
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
      const result = await caller.frontingReport.list({ systemId: MOCK_SYSTEM_ID });

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
        systemId: MOCK_SYSTEM_ID,
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
        systemId: MOCK_SYSTEM_ID,
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
        systemId: MOCK_SYSTEM_ID,
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
        caller.frontingReport.get({ systemId: MOCK_SYSTEM_ID, reportId: REPORT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateFrontingReport).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingReport.update({
          systemId: MOCK_SYSTEM_ID,
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
    vi.mocked(listFrontingReports).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.frontingReport.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createFrontingReport).mockResolvedValue(MOCK_REPORT_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.frontingReport.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          format: "html",
          generatedAt: 1_700_000_000_000,
        }),
      "write",
    );
  });
});
