import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertProcedureRateLimited, makeCallerFactory, MOCK_SYSTEM_ID } from "../test-helpers.js";

import type {
  AccountId,
  ImportEntityRef,
  ImportEntityRefId,
  MemberId,
  PaginatedResult,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/import-entity-ref.service.js", () => ({
  listImportEntityRefs: vi.fn(),
  lookupImportEntityRef: vi.fn(),
  lookupImportEntityRefBatch: vi.fn(),
  upsertImportEntityRefBatch: vi.fn(),
}));

const {
  listImportEntityRefs,
  lookupImportEntityRef,
  lookupImportEntityRefBatch,
  upsertImportEntityRefBatch,
} = await import("../../../services/import-entity-ref.service.js");

const { importEntityRefRouter } = await import("../../../trpc/routers/import-entity-ref.js");

const createCaller = makeCallerFactory({ importEntityRef: importEntityRefRouter });

const REF_ID = brandId<ImportEntityRefId>("ier_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const ACCOUNT_ID = brandId<AccountId>("acct_test001");
const MEMBER_PS_ID = brandId<MemberId>("mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

const MOCK_REF: ImportEntityRef = {
  id: REF_ID,
  accountId: ACCOUNT_ID,
  systemId: MOCK_SYSTEM_ID,
  source: "simply-plural",
  sourceEntityType: "member",
  sourceEntityId: "sp_member_001",
  pluralscapeEntityId: MEMBER_PS_ID,
  importedAt: 1_700_000_000_000 as UnixMillis,
};

const MOCK_PAGINATED: PaginatedResult<ImportEntityRef> = {
  data: [MOCK_REF],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("importEntityRef router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("importEntityRef.list", () => {
    it("calls listImportEntityRefs and returns result", async () => {
      vi.mocked(listImportEntityRefs).mockResolvedValue(MOCK_PAGINATED);
      const caller = createCaller();
      const result = await caller.importEntityRef.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listImportEntityRefs)).toHaveBeenCalledOnce();
      expect(vi.mocked(listImportEntityRefs).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_PAGINATED);
    });

    it("passes optional filter params", async () => {
      vi.mocked(listImportEntityRefs).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.importEntityRef.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        source: "simply-plural",
        entityType: "member",
        sourceEntityId: "sp_001",
      });

      const opts = vi.mocked(listImportEntityRefs).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.source).toBe("simply-plural");
      expect(opts?.entityType).toBe("member");
      expect(opts?.sourceEntityId).toBe("sp_001");
    });

    it("rejects limit above MAX_PAGE_LIMIT", async () => {
      const caller = createCaller();
      await expect(
        caller.importEntityRef.list({ systemId: MOCK_SYSTEM_ID, limit: 101 }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.importEntityRef.list({ systemId: MOCK_SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── lookup ────────────────────────────────────────────────────────

  describe("importEntityRef.lookup", () => {
    it("calls lookupImportEntityRef with input", async () => {
      vi.mocked(lookupImportEntityRef).mockResolvedValue(MOCK_REF);
      const caller = createCaller();
      const result = await caller.importEntityRef.lookup({
        systemId: MOCK_SYSTEM_ID,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityId: "sp_member_001",
      });

      expect(vi.mocked(lookupImportEntityRef)).toHaveBeenCalledOnce();
      expect(vi.mocked(lookupImportEntityRef).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_REF);
    });
  });

  // ── lookupBatch ───────────────────────────────────────────────────

  describe("importEntityRef.lookupBatch", () => {
    it("calls lookupImportEntityRefBatch and converts Map to plain object", async () => {
      const mockMap: ReadonlyMap<string, string> = new Map([["sp_001", "mem_resolved"]]);
      vi.mocked(lookupImportEntityRefBatch).mockResolvedValue(mockMap);
      const caller = createCaller();
      const result = await caller.importEntityRef.lookupBatch({
        systemId: MOCK_SYSTEM_ID,
        source: "simply-plural",
        sourceEntityType: "member",
        sourceEntityIds: ["sp_001"],
      });

      expect(vi.mocked(lookupImportEntityRefBatch)).toHaveBeenCalledOnce();
      expect(vi.mocked(lookupImportEntityRefBatch).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual({ sp_001: "mem_resolved" });
    });

    it("rejects empty sourceEntityIds array", async () => {
      const caller = createCaller();
      await expect(
        caller.importEntityRef.lookupBatch({
          systemId: MOCK_SYSTEM_ID,
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityIds: [],
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── upsertBatch ───────────────────────────────────────────────────

  describe("importEntityRef.upsertBatch", () => {
    it("calls upsertImportEntityRefBatch with input", async () => {
      vi.mocked(upsertImportEntityRefBatch).mockResolvedValue({ upserted: 1, unchanged: 0 });
      const caller = createCaller();
      const result = await caller.importEntityRef.upsertBatch({
        systemId: MOCK_SYSTEM_ID,
        source: "simply-plural",
        entries: [
          {
            sourceEntityType: "member",
            sourceEntityId: "sp_member_001",
            pluralscapeEntityId: "mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          },
        ],
      });

      expect(vi.mocked(upsertImportEntityRefBatch)).toHaveBeenCalledOnce();
      expect(vi.mocked(upsertImportEntityRefBatch).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual({ upserted: 1, unchanged: 0 });
    });

    it("rejects empty entries array", async () => {
      const caller = createCaller();
      await expect(
        caller.importEntityRef.upsertBatch({
          systemId: MOCK_SYSTEM_ID,
          source: "simply-plural",
          entries: [],
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── rate limiting ─────────────────────────────────────────────────

  it("applies readDefault rate limiting to list", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listImportEntityRefs).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.importEntityRef.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies write rate limiting to upsertBatch", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(upsertImportEntityRefBatch).mockResolvedValue({ upserted: 1, unchanged: 0 });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.importEntityRef.upsertBatch({
          systemId: MOCK_SYSTEM_ID,
          source: "simply-plural",
          entries: [
            {
              sourceEntityType: "member",
              sourceEntityId: "sp_member_001",
              pluralscapeEntityId: "mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            },
          ],
        }),
      "write",
    );
  });
});
