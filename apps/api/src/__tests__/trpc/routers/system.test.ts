import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type { AccountId, SessionId, SystemId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/system.service.js", () => ({
  createSystem: vi.fn(),
  getSystemProfile: vi.fn(),
  listSystems: vi.fn(),
  updateSystemProfile: vi.fn(),
  archiveSystem: vi.fn(),
}));

vi.mock("../../../services/system-duplicate.service.js", () => ({
  duplicateSystem: vi.fn(),
}));

vi.mock("../../../services/system-purge.service.js", () => ({
  purgeSystem: vi.fn(),
}));

const { createSystem, getSystemProfile, listSystems, updateSystemProfile, archiveSystem } =
  await import("../../../services/system.service.js");

const { duplicateSystem } = await import("../../../services/system-duplicate.service.js");
const { purgeSystem } = await import("../../../services/system-purge.service.js");

const { systemRouter } = await import("../../../trpc/routers/system.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const SOURCE_SNAPSHOT_ID = "snap_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

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
  const appRouter = router({ system: systemRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_SYSTEM_RESULT = {
  id: SYSTEM_ID,
  encryptedData: null,
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("system router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("system.create", () => {
    it("calls createSystem with db, auth, and audit and returns result", async () => {
      vi.mocked(createSystem).mockResolvedValue(MOCK_SYSTEM_RESULT);
      const caller = makeCaller();
      const result = await caller.system.create();

      expect(vi.mocked(createSystem)).toHaveBeenCalledOnce();
      expect(vi.mocked(createSystem).mock.calls[0]?.[1]).toEqual(MOCK_AUTH);
      expect(result).toEqual(MOCK_SYSTEM_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(caller.system.create()).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("system.get", () => {
    it("calls getSystemProfile with correct systemId", async () => {
      vi.mocked(getSystemProfile).mockResolvedValue(MOCK_SYSTEM_RESULT);
      const caller = makeCaller();
      const result = await caller.system.get({ systemId: SYSTEM_ID });

      expect(vi.mocked(getSystemProfile)).toHaveBeenCalledOnce();
      expect(vi.mocked(getSystemProfile).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_SYSTEM_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(caller.system.get({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = makeCaller();
      await expect(caller.system.get({ systemId: foreignSystemId })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });

    it("rejects invalid systemId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.system.get({ systemId: "not-a-system-id" as SystemId }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getSystemProfile).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "System not found"),
      );
      const caller = makeCaller();
      await expect(caller.system.get({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("system.list", () => {
    it("calls listSystems with accountId from auth and returns result", async () => {
      const mockResult = {
        data: [MOCK_SYSTEM_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listSystems).mockResolvedValue(mockResult);
      const caller = makeCaller();
      const result = await caller.system.list({});

      expect(vi.mocked(listSystems)).toHaveBeenCalledOnce();
      expect(vi.mocked(listSystems).mock.calls[0]?.[1]).toBe(MOCK_AUTH.accountId);
      expect(result).toEqual(mockResult);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(caller.system.list({})).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("passes cursor and limit opts through", async () => {
      vi.mocked(listSystems).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = makeCaller();
      await caller.system.list({ cursor: "cur_abc", limit: 5 });

      expect(vi.mocked(listSystems).mock.calls[0]?.[2]).toBe("cur_abc");
      expect(vi.mocked(listSystems).mock.calls[0]?.[3]).toBe(5);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("system.update", () => {
    it("calls updateSystemProfile with correct systemId and returns result", async () => {
      vi.mocked(updateSystemProfile).mockResolvedValue(MOCK_SYSTEM_RESULT);
      const caller = makeCaller();
      const result = await caller.system.update({
        systemId: SYSTEM_ID,
        encryptedData: "dGVzdGRhdGFmb3JzeXN0ZW0=",
        version: 1,
      });

      expect(vi.mocked(updateSystemProfile)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateSystemProfile).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_SYSTEM_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateSystemProfile).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = makeCaller();
      await expect(
        caller.system.update({
          systemId: SYSTEM_ID,
          encryptedData: "dGVzdGRhdGFmb3JzeXN0ZW0=",
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("system.archive", () => {
    it("calls archiveSystem and returns success", async () => {
      vi.mocked(archiveSystem).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.system.archive({ systemId: SYSTEM_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveSystem)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveSystem).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveSystem).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "System not found"),
      );
      const caller = makeCaller();
      await expect(caller.system.archive({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(archiveSystem).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Cannot delete the only system"),
      );
      const caller = makeCaller();
      await expect(caller.system.archive({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "CONFLICT" }),
      );
    });
  });

  // ── duplicate ─────────────────────────────────────────────────────

  describe("system.duplicate", () => {
    it("calls duplicateSystem with correct sourceSystemId and returns result", async () => {
      const mockResult = { id: SYSTEM_ID, sourceSnapshotId: SOURCE_SNAPSHOT_ID };
      vi.mocked(duplicateSystem).mockResolvedValue(mockResult as never);
      const caller = makeCaller();
      const result = await caller.system.duplicate({
        systemId: SYSTEM_ID,
        snapshotId: SOURCE_SNAPSHOT_ID,
      });

      expect(vi.mocked(duplicateSystem)).toHaveBeenCalledOnce();
      expect(vi.mocked(duplicateSystem).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(duplicateSystem).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Source system not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.system.duplicate({ systemId: SYSTEM_ID, snapshotId: SOURCE_SNAPSHOT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── purge ─────────────────────────────────────────────────────────

  describe("system.purge", () => {
    it("calls purgeSystem and returns success", async () => {
      vi.mocked(purgeSystem).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.system.purge({
        systemId: SYSTEM_ID,
        password: "correct-password",
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(purgeSystem)).toHaveBeenCalledOnce();
      expect(vi.mocked(purgeSystem).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(purgeSystem).mockRejectedValue(
        new ApiHttpError(400, "VALIDATION_ERROR", "Incorrect password"),
      );
      const caller = makeCaller();
      await expect(
        caller.system.purge({ systemId: SYSTEM_ID, password: "wrong-password" }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(purgeSystem).mockRejectedValue(
        new ApiHttpError(409, "NOT_ARCHIVED", "System must be archived first"),
      );
      const caller = makeCaller();
      await expect(
        caller.system.purge({ systemId: SYSTEM_ID, password: "password" }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });
});
