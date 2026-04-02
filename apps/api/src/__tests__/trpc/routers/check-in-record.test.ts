import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type {
  AccountId,
  CheckInRecordId,
  MemberId,
  SessionId,
  SystemId,
  TimerId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/check-in-record.service.js", () => ({
  createCheckInRecord: vi.fn(),
  getCheckInRecord: vi.fn(),
  listCheckInRecords: vi.fn(),
  respondCheckInRecord: vi.fn(),
  dismissCheckInRecord: vi.fn(),
  archiveCheckInRecord: vi.fn(),
  restoreCheckInRecord: vi.fn(),
  deleteCheckInRecord: vi.fn(),
}));

const {
  createCheckInRecord,
  getCheckInRecord,
  listCheckInRecords,
  respondCheckInRecord,
  dismissCheckInRecord,
  archiveCheckInRecord,
  restoreCheckInRecord,
  deleteCheckInRecord,
} = await import("../../../services/check-in-record.service.js");

const { checkInRecordRouter } = await import("../../../trpc/routers/check-in-record.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const RECORD_ID = "cir_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as CheckInRecordId;
const TIMER_ID = "tmr_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as TimerId;
const MEMBER_ID = "mem_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as MemberId;

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test001" as AccountId,
  systemId: SYSTEM_ID,
  sessionId: "sess_test001" as SessionId,
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
  auditLogIpTracking: false,
};

const noopAuditWriter: AuditWriter = () => Promise.resolve();

function makeContext(auth: AuthContext | null): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  };
}

function makeCaller(auth: AuthContext | null = MOCK_AUTH) {
  const appRouter = router({ checkInRecord: checkInRecordRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_PENDING_RESULT = {
  id: RECORD_ID,
  systemId: SYSTEM_ID,
  timerConfigId: TIMER_ID,
  scheduledAt: 1_700_000_000_000 as UnixMillis,
  encryptedData: null,
  archived: false,
  archivedAt: null,
  status: "pending" as const,
  respondedByMemberId: null,
  respondedAt: null,
  dismissed: false as const,
};

const MOCK_RESPONDED_RESULT = {
  ...MOCK_PENDING_RESULT,
  status: "responded" as const,
  respondedByMemberId: MEMBER_ID,
  respondedAt: 1_700_000_001_000 as UnixMillis,
  dismissed: false as const,
};

const MOCK_DISMISSED_RESULT = {
  ...MOCK_PENDING_RESULT,
  status: "dismissed" as const,
  respondedByMemberId: null,
  respondedAt: null,
  dismissed: true as const,
};

describe("checkInRecord router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ───────────────────────────────────────────────────────────

  describe("checkInRecord.create", () => {
    it("calls createCheckInRecord with correct systemId and returns result", async () => {
      vi.mocked(createCheckInRecord).mockResolvedValue(MOCK_PENDING_RESULT);
      const caller = makeCaller();
      const result = await caller.checkInRecord.create({
        systemId: SYSTEM_ID,
        timerConfigId: TIMER_ID,
        scheduledAt: 1_700_000_000_000,
      });

      expect(vi.mocked(createCheckInRecord)).toHaveBeenCalledOnce();
      expect(vi.mocked(createCheckInRecord).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_PENDING_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(
        caller.checkInRecord.create({
          systemId: SYSTEM_ID,
          timerConfigId: TIMER_ID,
          scheduledAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = makeCaller();
      await expect(
        caller.checkInRecord.create({
          systemId: foreignSystemId,
          timerConfigId: TIMER_ID,
          scheduledAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ──────────────────────────────────────────────────────────────

  describe("checkInRecord.get", () => {
    it("calls getCheckInRecord with correct systemId and recordId", async () => {
      vi.mocked(getCheckInRecord).mockResolvedValue(MOCK_PENDING_RESULT);
      const caller = makeCaller();
      const result = await caller.checkInRecord.get({ systemId: SYSTEM_ID, recordId: RECORD_ID });

      expect(vi.mocked(getCheckInRecord)).toHaveBeenCalledOnce();
      expect(vi.mocked(getCheckInRecord).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getCheckInRecord).mock.calls[0]?.[2]).toBe(RECORD_ID);
      expect(result).toEqual(MOCK_PENDING_RESULT);
    });

    it("rejects invalid recordId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.checkInRecord.get({
          systemId: SYSTEM_ID,
          recordId: "not-a-record-id" as CheckInRecordId,
        }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getCheckInRecord).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Check-in record not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.checkInRecord.get({ systemId: SYSTEM_ID, recordId: RECORD_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("checkInRecord.list", () => {
    it("calls listCheckInRecords and returns result", async () => {
      const mockResult = {
        data: [MOCK_PENDING_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listCheckInRecords).mockResolvedValue(mockResult);
      const caller = makeCaller();
      const result = await caller.checkInRecord.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listCheckInRecords)).toHaveBeenCalledOnce();
      expect(vi.mocked(listCheckInRecords).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes timerConfigId and pending filters as opts", async () => {
      vi.mocked(listCheckInRecords).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = makeCaller();
      await caller.checkInRecord.list({
        systemId: SYSTEM_ID,
        timerConfigId: TIMER_ID,
        pending: true,
        cursor: "cursor_abc",
        limit: 5,
      });

      const opts = vi.mocked(listCheckInRecords).mock.calls[0]?.[3];
      expect(opts?.timerConfigId).toBe(TIMER_ID);
      expect(opts?.pending).toBe(true);
      expect(opts?.cursor).toBe("cursor_abc");
      expect(opts?.limit).toBe(5);
    });
  });

  // ── respond ──────────────────────────────────────────────────────────

  describe("checkInRecord.respond", () => {
    it("calls respondCheckInRecord with correct systemId, recordId, and returns result", async () => {
      vi.mocked(respondCheckInRecord).mockResolvedValue(MOCK_RESPONDED_RESULT);
      const caller = makeCaller();
      const result = await caller.checkInRecord.respond({
        systemId: SYSTEM_ID,
        recordId: RECORD_ID,
        respondedByMemberId: MEMBER_ID,
      });

      expect(vi.mocked(respondCheckInRecord)).toHaveBeenCalledOnce();
      expect(vi.mocked(respondCheckInRecord).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(respondCheckInRecord).mock.calls[0]?.[2]).toBe(RECORD_ID);
      expect(result).toEqual(MOCK_RESPONDED_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT when already responded", async () => {
      vi.mocked(respondCheckInRecord).mockRejectedValue(
        new ApiHttpError(409, "ALREADY_RESPONDED", "Check-in already responded"),
      );
      const caller = makeCaller();
      await expect(
        caller.checkInRecord.respond({
          systemId: SYSTEM_ID,
          recordId: RECORD_ID,
          respondedByMemberId: MEMBER_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── dismiss ──────────────────────────────────────────────────────────

  describe("checkInRecord.dismiss", () => {
    it("calls dismissCheckInRecord with correct systemId and recordId", async () => {
      vi.mocked(dismissCheckInRecord).mockResolvedValue(MOCK_DISMISSED_RESULT);
      const caller = makeCaller();
      const result = await caller.checkInRecord.dismiss({
        systemId: SYSTEM_ID,
        recordId: RECORD_ID,
      });

      expect(vi.mocked(dismissCheckInRecord)).toHaveBeenCalledOnce();
      expect(vi.mocked(dismissCheckInRecord).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(dismissCheckInRecord).mock.calls[0]?.[2]).toBe(RECORD_ID);
      expect(result).toEqual(MOCK_DISMISSED_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT when already dismissed", async () => {
      vi.mocked(dismissCheckInRecord).mockRejectedValue(
        new ApiHttpError(409, "ALREADY_DISMISSED", "Check-in already dismissed"),
      );
      const caller = makeCaller();
      await expect(
        caller.checkInRecord.dismiss({ systemId: SYSTEM_ID, recordId: RECORD_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ──────────────────────────────────────────────────────────

  describe("checkInRecord.archive", () => {
    it("calls archiveCheckInRecord and returns success", async () => {
      vi.mocked(archiveCheckInRecord).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.checkInRecord.archive({
        systemId: SYSTEM_ID,
        recordId: RECORD_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveCheckInRecord)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveCheckInRecord).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveCheckInRecord).mock.calls[0]?.[2]).toBe(RECORD_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveCheckInRecord).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Check-in record not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.checkInRecord.archive({ systemId: SYSTEM_ID, recordId: RECORD_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ──────────────────────────────────────────────────────────

  describe("checkInRecord.restore", () => {
    it("calls restoreCheckInRecord and returns result", async () => {
      vi.mocked(restoreCheckInRecord).mockResolvedValue(MOCK_PENDING_RESULT);
      const caller = makeCaller();
      const result = await caller.checkInRecord.restore({
        systemId: SYSTEM_ID,
        recordId: RECORD_ID,
      });

      expect(vi.mocked(restoreCheckInRecord)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreCheckInRecord).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreCheckInRecord).mock.calls[0]?.[2]).toBe(RECORD_ID);
      expect(result).toEqual(MOCK_PENDING_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreCheckInRecord).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Check-in record not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.checkInRecord.restore({ systemId: SYSTEM_ID, recordId: RECORD_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ───────────────────────────────────────────────────────────

  describe("checkInRecord.delete", () => {
    it("calls deleteCheckInRecord and returns success", async () => {
      vi.mocked(deleteCheckInRecord).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.checkInRecord.delete({
        systemId: SYSTEM_ID,
        recordId: RECORD_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteCheckInRecord)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteCheckInRecord).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteCheckInRecord).mock.calls[0]?.[2]).toBe(RECORD_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteCheckInRecord).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Check-in record not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.checkInRecord.delete({ systemId: SYSTEM_ID, recordId: RECORD_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
