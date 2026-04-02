import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type {
  AccountId,
  SessionId,
  SystemId,
  SystemSnapshotId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/snapshot.service.js", () => ({
  createSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
}));

const { createSnapshot, getSnapshot, listSnapshots } =
  await import("../../../services/snapshot.service.js");

const { snapshotRouter } = await import("../../../trpc/routers/snapshot.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const SNAPSHOT_ID = "snap_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as SystemSnapshotId;

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
  const appRouter = router({ snapshot: snapshotRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_SNAPSHOT_RESULT = {
  id: SNAPSHOT_ID,
  systemId: SYSTEM_ID,
  snapshotTrigger: "manual" as const,
  encryptedData: "dGVzdGVuY3J5cHRlZGRhdGE=",
  createdAt: 1_700_000_000_000 as UnixMillis,
};

const VALID_CREATE_INPUT = {
  systemId: SYSTEM_ID,
  snapshotTrigger: "manual" as const,
  encryptedData: "dGVzdGVuY3J5cHRlZGRhdGE=",
};

describe("snapshot router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("snapshot.create", () => {
    it("calls createSnapshot with correct systemId and returns result", async () => {
      vi.mocked(createSnapshot).mockResolvedValue(MOCK_SNAPSHOT_RESULT);
      const caller = makeCaller();
      const result = await caller.snapshot.create(VALID_CREATE_INPUT);

      expect(vi.mocked(createSnapshot)).toHaveBeenCalledOnce();
      expect(vi.mocked(createSnapshot).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_SNAPSHOT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(caller.snapshot.create(VALID_CREATE_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = makeCaller();
      await expect(
        caller.snapshot.create({ ...VALID_CREATE_INPUT, systemId: foreignSystemId }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(createSnapshot).mockRejectedValue(
        new ApiHttpError(400, "VALIDATION_ERROR", "Invalid payload"),
      );
      const caller = makeCaller();
      await expect(caller.snapshot.create(VALID_CREATE_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("snapshot.get", () => {
    it("calls getSnapshot with correct systemId and snapshotId", async () => {
      vi.mocked(getSnapshot).mockResolvedValue(MOCK_SNAPSHOT_RESULT);
      const caller = makeCaller();
      const result = await caller.snapshot.get({ systemId: SYSTEM_ID, snapshotId: SNAPSHOT_ID });

      expect(vi.mocked(getSnapshot)).toHaveBeenCalledOnce();
      expect(vi.mocked(getSnapshot).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getSnapshot).mock.calls[0]?.[2]).toBe(SNAPSHOT_ID);
      expect(result).toEqual(MOCK_SNAPSHOT_RESULT);
    });

    it("rejects invalid snapshotId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.snapshot.get({
          systemId: SYSTEM_ID,
          snapshotId: "invalid-id" as SystemSnapshotId,
        }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getSnapshot).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Snapshot not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.snapshot.get({ systemId: SYSTEM_ID, snapshotId: SNAPSHOT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("snapshot.list", () => {
    it("calls listSnapshots and returns result", async () => {
      const mockResult = {
        data: [MOCK_SNAPSHOT_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listSnapshots).mockResolvedValue(mockResult);
      const caller = makeCaller();
      const result = await caller.snapshot.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listSnapshots)).toHaveBeenCalledOnce();
      expect(vi.mocked(listSnapshots).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor and limit", async () => {
      vi.mocked(listSnapshots).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = makeCaller();
      await caller.snapshot.list({ systemId: SYSTEM_ID, cursor: "snap_cursor", limit: 10 });

      expect(vi.mocked(listSnapshots).mock.calls[0]?.[3]).toBe("snap_cursor");
      expect(vi.mocked(listSnapshots).mock.calls[0]?.[4]).toBe(10);
    });
  });
});
