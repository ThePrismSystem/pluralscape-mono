import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertProcedureRateLimited, makeCallerFactory, MOCK_SYSTEM_ID } from "../test-helpers.js";

import type { ImportJobResult } from "../../../services/system/import-jobs/internal.js";
import type { AccountId, ImportCollectionType, ImportJobId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/system/import-jobs/create.js", () => ({
  createImportJob: vi.fn(),
}));
vi.mock("../../../services/system/import-jobs/get.js", () => ({
  getImportJob: vi.fn(),
}));
vi.mock("../../../services/system/import-jobs/list.js", () => ({
  listImportJobs: vi.fn(),
}));
vi.mock("../../../services/system/import-jobs/update.js", () => ({
  updateImportJob: vi.fn(),
}));

const { createImportJob } = await import("../../../services/system/import-jobs/create.js");
const { getImportJob } = await import("../../../services/system/import-jobs/get.js");
const { listImportJobs } = await import("../../../services/system/import-jobs/list.js");
const { updateImportJob } = await import("../../../services/system/import-jobs/update.js");

const { importJobRouter } = await import("../../../trpc/routers/import-job.js");

const createCaller = makeCallerFactory({ importJob: importJobRouter });

const JOB_ID = brandId<ImportJobId>("ij_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const ACCOUNT_ID = brandId<AccountId>("acct_test001");

const MOCK_JOB: ImportJobResult = {
  id: JOB_ID,
  accountId: ACCOUNT_ID,
  systemId: MOCK_SYSTEM_ID,
  source: "simply-plural",
  status: "pending",
  progressPercent: 0,
  errorLog: null,
  warningCount: 0,
  chunksTotal: null,
  chunksCompleted: 0,
  checkpointState: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
  completedAt: null,
};

describe("importJob router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("importJob.create", () => {
    it("calls createImportJob with systemId and returns result", async () => {
      vi.mocked(createImportJob).mockResolvedValue(MOCK_JOB);
      const caller = createCaller();
      const result = await caller.importJob.create({
        systemId: MOCK_SYSTEM_ID,
        source: "simply-plural",
        selectedCategories: { member: true } as Record<ImportCollectionType, boolean | undefined>,
        avatarMode: "skip",
      });

      expect(vi.mocked(createImportJob)).toHaveBeenCalledOnce();
      expect(vi.mocked(createImportJob).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_JOB);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.importJob.create({
          systemId: MOCK_SYSTEM_ID,
          source: "simply-plural",
          selectedCategories: { member: true } as Record<ImportCollectionType, boolean | undefined>,
          avatarMode: "skip",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("importJob.get", () => {
    it("calls getImportJob with systemId and importJobId", async () => {
      vi.mocked(getImportJob).mockResolvedValue(MOCK_JOB);
      const caller = createCaller();
      const result = await caller.importJob.get({
        systemId: MOCK_SYSTEM_ID,
        importJobId: JOB_ID,
      });

      expect(vi.mocked(getImportJob)).toHaveBeenCalledOnce();
      expect(vi.mocked(getImportJob).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getImportJob).mock.calls[0]?.[2]).toBe(JOB_ID);
      expect(result).toEqual(MOCK_JOB);
    });

    it("rejects invalid importJobId format", async () => {
      const caller = createCaller();
      await expect(
        caller.importJob.get({
          systemId: MOCK_SYSTEM_ID,
          importJobId: brandId<ImportJobId>("not-a-job-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("importJob.list", () => {
    it("calls listImportJobs with systemId and returns result", async () => {
      vi.mocked(listImportJobs).mockResolvedValue({
        data: [MOCK_JOB],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      const result = await caller.importJob.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listImportJobs)).toHaveBeenCalledOnce();
      expect(vi.mocked(listImportJobs).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result.data).toHaveLength(1);
    });

    it("passes optional filter params", async () => {
      vi.mocked(listImportJobs).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.importJob.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cur_abc",
        limit: 5,
        status: "pending",
        source: "simply-plural",
      });

      const opts = vi.mocked(listImportJobs).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(5);
      expect(opts?.status).toBe("pending");
      expect(opts?.source).toBe("simply-plural");
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("importJob.update", () => {
    it("calls updateImportJob with systemId, importJobId, and body", async () => {
      vi.mocked(updateImportJob).mockResolvedValue(MOCK_JOB);
      const caller = createCaller();
      const result = await caller.importJob.update({
        systemId: MOCK_SYSTEM_ID,
        importJobId: JOB_ID,
        status: "importing",
        progressPercent: 50,
      });

      expect(vi.mocked(updateImportJob)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateImportJob).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateImportJob).mock.calls[0]?.[2]).toBe(JOB_ID);
      expect(result).toEqual(MOCK_JOB);
    });

    it("rejects invalid importJobId format", async () => {
      const caller = createCaller();
      await expect(
        caller.importJob.update({
          systemId: MOCK_SYSTEM_ID,
          importJobId: brandId<ImportJobId>("bad-id"),
          status: "importing",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── rate limiting ─────────────────────────────────────────────────

  it("applies readDefault rate limiting to list", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listImportJobs).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.importJob.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies write rate limiting to create", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createImportJob).mockResolvedValue(MOCK_JOB);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.importJob.create({
          systemId: MOCK_SYSTEM_ID,
          source: "simply-plural",
          selectedCategories: { member: true } as Record<ImportCollectionType, boolean | undefined>,
          avatarMode: "skip",
        }),
      "write",
    );
  });
});
