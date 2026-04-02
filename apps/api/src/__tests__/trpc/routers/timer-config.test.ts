import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { TimerId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/timer-config.service.js", () => ({
  createTimerConfig: vi.fn(),
  getTimerConfig: vi.fn(),
  listTimerConfigs: vi.fn(),
  updateTimerConfig: vi.fn(),
  archiveTimerConfig: vi.fn(),
  restoreTimerConfig: vi.fn(),
}));

const {
  createTimerConfig,
  getTimerConfig,
  listTimerConfigs,
  updateTimerConfig,
  archiveTimerConfig,
  restoreTimerConfig,
} = await import("../../../services/timer-config.service.js");

const { timerConfigRouter } = await import("../../../trpc/routers/timer-config.js");

const createCaller = makeCallerFactory({ timerConfig: timerConfigRouter });

const TIMER_ID = "tmr_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as TimerId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3J0aW1lcg==";

const MOCK_TIMER_RESULT = {
  id: TIMER_ID,
  systemId: MOCK_SYSTEM_ID,
  enabled: true,
  intervalMinutes: 60,
  wakingHoursOnly: false as const,
  wakingStart: null,
  wakingEnd: null,
  encryptedData: VALID_ENCRYPTED_DATA,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("timerConfig router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ───────────────────────────────────────────────────────────

  describe("timerConfig.create", () => {
    it("calls createTimerConfig with correct systemId and returns result", async () => {
      vi.mocked(createTimerConfig).mockResolvedValue(MOCK_TIMER_RESULT);
      const caller = createCaller();
      const result = await caller.timerConfig.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createTimerConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(createTimerConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_TIMER_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.timerConfig.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.timerConfig.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ──────────────────────────────────────────────────────────────

  describe("timerConfig.get", () => {
    it("calls getTimerConfig with correct systemId and timerId", async () => {
      vi.mocked(getTimerConfig).mockResolvedValue(MOCK_TIMER_RESULT);
      const caller = createCaller();
      const result = await caller.timerConfig.get({ systemId: MOCK_SYSTEM_ID, timerId: TIMER_ID });

      expect(vi.mocked(getTimerConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(getTimerConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getTimerConfig).mock.calls[0]?.[2]).toBe(TIMER_ID);
      expect(result).toEqual(MOCK_TIMER_RESULT);
    });

    it("rejects invalid timerId format", async () => {
      const caller = createCaller();
      await expect(
        caller.timerConfig.get({
          systemId: MOCK_SYSTEM_ID,
          timerId: "not-a-timer-id" as TimerId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getTimerConfig).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
      );
      const caller = createCaller();
      await expect(
        caller.timerConfig.get({ systemId: MOCK_SYSTEM_ID, timerId: TIMER_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("timerConfig.list", () => {
    it("calls listTimerConfigs and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_TIMER_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listTimerConfigs).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.timerConfig.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listTimerConfigs)).toHaveBeenCalledOnce();
      expect(vi.mocked(listTimerConfigs).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeArchived opts to service", async () => {
      vi.mocked(listTimerConfigs).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.timerConfig.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cursor_abc",
        limit: 10,
        includeArchived: true,
      });

      const opts = vi.mocked(listTimerConfigs).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cursor_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
    });
  });

  // ── update ───────────────────────────────────────────────────────────

  describe("timerConfig.update", () => {
    it("calls updateTimerConfig with correct systemId, timerId, and returns result", async () => {
      vi.mocked(updateTimerConfig).mockResolvedValue({ ...MOCK_TIMER_RESULT, version: 2 });
      const caller = createCaller();
      const result = await caller.timerConfig.update({
        systemId: MOCK_SYSTEM_ID,
        timerId: TIMER_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateTimerConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateTimerConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateTimerConfig).mock.calls[0]?.[2]).toBe(TIMER_ID);
      expect(result.version).toBe(2);
    });

    it("surfaces ApiHttpError(409) as CONFLICT on version conflict", async () => {
      vi.mocked(updateTimerConfig).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Timer config was modified by another request"),
      );
      const caller = createCaller();
      await expect(
        caller.timerConfig.update({
          systemId: MOCK_SYSTEM_ID,
          timerId: TIMER_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(updateTimerConfig).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
      );
      const caller = createCaller();
      await expect(
        caller.timerConfig.update({
          systemId: MOCK_SYSTEM_ID,
          timerId: TIMER_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── archive ──────────────────────────────────────────────────────────

  describe("timerConfig.archive", () => {
    it("calls archiveTimerConfig and returns success", async () => {
      vi.mocked(archiveTimerConfig).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.timerConfig.archive({
        systemId: MOCK_SYSTEM_ID,
        timerId: TIMER_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveTimerConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveTimerConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveTimerConfig).mock.calls[0]?.[2]).toBe(TIMER_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveTimerConfig).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
      );
      const caller = createCaller();
      await expect(
        caller.timerConfig.archive({ systemId: MOCK_SYSTEM_ID, timerId: TIMER_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ──────────────────────────────────────────────────────────

  describe("timerConfig.restore", () => {
    it("calls restoreTimerConfig and returns result", async () => {
      vi.mocked(restoreTimerConfig).mockResolvedValue({ ...MOCK_TIMER_RESULT, archived: false });
      const caller = createCaller();
      const result = await caller.timerConfig.restore({
        systemId: MOCK_SYSTEM_ID,
        timerId: TIMER_ID,
      });

      expect(vi.mocked(restoreTimerConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreTimerConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreTimerConfig).mock.calls[0]?.[2]).toBe(TIMER_ID);
      expect(result).toBeDefined();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreTimerConfig).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Timer config not found"),
      );
      const caller = createCaller();
      await expect(
        caller.timerConfig.restore({ systemId: MOCK_SYSTEM_ID, timerId: TIMER_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listTimerConfigs).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.timerConfig.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createTimerConfig).mockResolvedValue(MOCK_TIMER_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.timerConfig.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      "write",
    );
  });
});
