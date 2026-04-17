import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { SystemSnapshotId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/snapshot.service.js", () => ({
  createSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  deleteSnapshot: vi.fn(),
}));

const { createSnapshot, getSnapshot, listSnapshots, deleteSnapshot } =
  await import("../../../services/snapshot.service.js");

const { snapshotRouter } = await import("../../../trpc/routers/snapshot.js");

const createCaller = makeCallerFactory({ snapshot: snapshotRouter });

const SNAPSHOT_ID = brandId<SystemSnapshotId>("snap_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

const MOCK_SNAPSHOT_RESULT = {
  id: SNAPSHOT_ID,
  systemId: MOCK_SYSTEM_ID,
  snapshotTrigger: "manual" as const,
  encryptedData: "dGVzdGVuY3J5cHRlZGRhdGE=",
  createdAt: 1_700_000_000_000 as UnixMillis,
};

const VALID_CREATE_INPUT = {
  systemId: MOCK_SYSTEM_ID,
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
      const caller = createCaller();
      const result = await caller.snapshot.create(VALID_CREATE_INPUT);

      expect(vi.mocked(createSnapshot)).toHaveBeenCalledOnce();
      expect(vi.mocked(createSnapshot).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_SNAPSHOT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.snapshot.create(VALID_CREATE_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
      const caller = createCaller();
      await expect(
        caller.snapshot.create({ ...VALID_CREATE_INPUT, systemId: foreignSystemId }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(createSnapshot).mockRejectedValue(
        new ApiHttpError(400, "VALIDATION_ERROR", "Invalid payload"),
      );
      const caller = createCaller();
      await expect(caller.snapshot.create(VALID_CREATE_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("snapshot.get", () => {
    it("calls getSnapshot with correct systemId and snapshotId", async () => {
      vi.mocked(getSnapshot).mockResolvedValue(MOCK_SNAPSHOT_RESULT);
      const caller = createCaller();
      const result = await caller.snapshot.get({
        systemId: MOCK_SYSTEM_ID,
        snapshotId: SNAPSHOT_ID,
      });

      expect(vi.mocked(getSnapshot)).toHaveBeenCalledOnce();
      expect(vi.mocked(getSnapshot).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getSnapshot).mock.calls[0]?.[2]).toBe(SNAPSHOT_ID);
      expect(result).toEqual(MOCK_SNAPSHOT_RESULT);
    });

    it("rejects invalid snapshotId format", async () => {
      const caller = createCaller();
      await expect(
        caller.snapshot.get({
          systemId: MOCK_SYSTEM_ID,
          snapshotId: brandId<SystemSnapshotId>("invalid-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getSnapshot).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Snapshot not found"),
      );
      const caller = createCaller();
      await expect(
        caller.snapshot.get({ systemId: MOCK_SYSTEM_ID, snapshotId: SNAPSHOT_ID }),
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
      const caller = createCaller();
      const result = await caller.snapshot.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listSnapshots)).toHaveBeenCalledOnce();
      expect(vi.mocked(listSnapshots).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor and limit", async () => {
      vi.mocked(listSnapshots).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.snapshot.list({ systemId: MOCK_SYSTEM_ID, cursor: "snap_cursor", limit: 10 });

      expect(vi.mocked(listSnapshots).mock.calls[0]?.[3]).toBe("snap_cursor");
      expect(vi.mocked(listSnapshots).mock.calls[0]?.[4]).toBe(10);
    });

    it("converts null cursor to undefined", async () => {
      vi.mocked(listSnapshots).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.snapshot.list({ systemId: MOCK_SYSTEM_ID, cursor: null });

      expect(vi.mocked(listSnapshots).mock.calls[0]?.[3]).toBeUndefined();
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("snapshot.delete", () => {
    it("calls deleteSnapshot and returns success", async () => {
      vi.mocked(deleteSnapshot).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.snapshot.delete({
        systemId: MOCK_SYSTEM_ID,
        snapshotId: SNAPSHOT_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteSnapshot)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteSnapshot).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteSnapshot).mock.calls[0]?.[2]).toBe(SNAPSHOT_ID);
    });

    it("rejects invalid snapshotId format", async () => {
      const caller = createCaller();
      await expect(
        caller.snapshot.delete({
          systemId: MOCK_SYSTEM_ID,
          snapshotId: brandId<SystemSnapshotId>("invalid-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteSnapshot).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Snapshot not found"),
      );
      const caller = createCaller();
      await expect(
        caller.snapshot.delete({ systemId: MOCK_SYSTEM_ID, snapshotId: SNAPSHOT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listSnapshots).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.snapshot.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createSnapshot).mockResolvedValue(MOCK_SNAPSHOT_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.snapshot.create(VALID_CREATE_INPUT),
      "write",
    );
  });
});
