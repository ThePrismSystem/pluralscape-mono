import { beforeEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { FrontingAnalytics, CoFrontingAnalytics } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/analytics.service.js", () => ({
  computeFrontingBreakdown: vi.fn(),
  computeCoFrontingBreakdown: vi.fn(),
}));

const { computeFrontingBreakdown, computeCoFrontingBreakdown } =
  await import("../../../services/analytics.service.js");

const { analyticsRouter } = await import("../../../trpc/routers/analytics.js");

const createCaller = makeCallerFactory({ analytics: analyticsRouter });

const MOCK_FRONTING_ANALYTICS: FrontingAnalytics = {
  systemId: SYSTEM_ID,
  dateRange: {
    preset: "last-30-days",
    start: 1_697_000_000_000 as never,
    end: 1_700_000_000_000 as never,
  },
  subjectBreakdowns: [],
  truncated: false,
};

const MOCK_COFRONTING_ANALYTICS: CoFrontingAnalytics = {
  systemId: SYSTEM_ID,
  dateRange: {
    preset: "last-30-days",
    start: 1_697_000_000_000 as never,
    end: 1_700_000_000_000 as never,
  },
  coFrontingPercentage: 0,
  pairs: [],
  truncated: false,
};

describe("analytics router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── analytics.fronting ────────────────────────────────────────────

  describe("analytics.fronting", () => {
    it("calls computeFrontingBreakdown with correct systemId", async () => {
      vi.mocked(computeFrontingBreakdown).mockResolvedValue(MOCK_FRONTING_ANALYTICS);
      const caller = createCaller();
      const result = await caller.analytics.fronting({ systemId: SYSTEM_ID });

      expect(vi.mocked(computeFrontingBreakdown)).toHaveBeenCalledOnce();
      expect(vi.mocked(computeFrontingBreakdown).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_FRONTING_ANALYTICS);
    });

    it("defaults to last-30-days when no preset provided", async () => {
      vi.mocked(computeFrontingBreakdown).mockResolvedValue(MOCK_FRONTING_ANALYTICS);
      const caller = createCaller();
      await caller.analytics.fronting({ systemId: SYSTEM_ID });

      const dateRange = vi.mocked(computeFrontingBreakdown).mock.calls[0]?.[3];
      expect(dateRange?.preset).toBe("last-30-days");
    });

    it("accepts last-7-days preset", async () => {
      vi.mocked(computeFrontingBreakdown).mockResolvedValue(MOCK_FRONTING_ANALYTICS);
      const caller = createCaller();
      await caller.analytics.fronting({ systemId: SYSTEM_ID, preset: "last-7-days" });

      const dateRange = vi.mocked(computeFrontingBreakdown).mock.calls[0]?.[3];
      expect(dateRange?.preset).toBe("last-7-days");
    });

    it("accepts all-time preset", async () => {
      vi.mocked(computeFrontingBreakdown).mockResolvedValue(MOCK_FRONTING_ANALYTICS);
      const caller = createCaller();
      await caller.analytics.fronting({ systemId: SYSTEM_ID, preset: "all-time" });

      const dateRange = vi.mocked(computeFrontingBreakdown).mock.calls[0]?.[3];
      expect(dateRange?.preset).toBe("all-time");
    });

    it("accepts custom preset with valid date range", async () => {
      vi.mocked(computeFrontingBreakdown).mockResolvedValue(MOCK_FRONTING_ANALYTICS);
      const caller = createCaller();
      await caller.analytics.fronting({
        systemId: SYSTEM_ID,
        preset: "custom",
        startDate: 1_697_000_000_000,
        endDate: 1_700_000_000_000,
      });

      const dateRange = vi.mocked(computeFrontingBreakdown).mock.calls[0]?.[3];
      expect(dateRange?.preset).toBe("custom");
    });

    it("rejects custom preset without startDate/endDate", async () => {
      const caller = createCaller();
      await expect(
        caller.analytics.fronting({ systemId: SYSTEM_ID, preset: "custom" }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("rejects endDate before startDate", async () => {
      const caller = createCaller();
      await expect(
        caller.analytics.fronting({
          systemId: SYSTEM_ID,
          preset: "custom",
          startDate: 1_700_000_000_000,
          endDate: 1_697_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.analytics.fronting({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(caller.analytics.fronting({ systemId: foreignSystemId })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── analytics.coFronting ──────────────────────────────────────────

  describe("analytics.coFronting", () => {
    it("calls computeCoFrontingBreakdown with correct systemId", async () => {
      vi.mocked(computeCoFrontingBreakdown).mockResolvedValue(MOCK_COFRONTING_ANALYTICS);
      const caller = createCaller();
      const result = await caller.analytics.coFronting({ systemId: SYSTEM_ID });

      expect(vi.mocked(computeCoFrontingBreakdown)).toHaveBeenCalledOnce();
      expect(vi.mocked(computeCoFrontingBreakdown).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_COFRONTING_ANALYTICS);
    });

    it("defaults to last-30-days when no preset provided", async () => {
      vi.mocked(computeCoFrontingBreakdown).mockResolvedValue(MOCK_COFRONTING_ANALYTICS);
      const caller = createCaller();
      await caller.analytics.coFronting({ systemId: SYSTEM_ID });

      const dateRange = vi.mocked(computeCoFrontingBreakdown).mock.calls[0]?.[3];
      expect(dateRange?.preset).toBe("last-30-days");
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.analytics.coFronting({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(computeFrontingBreakdown).mockResolvedValue(MOCK_FRONTING_ANALYTICS);
    const caller = createCaller();
    await caller.analytics.fronting({ systemId: SYSTEM_ID });
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalled();
    const callKey = vi.mocked(checkRateLimit).mock.calls[0]?.[0] as string;
    expect(callKey).toContain("readDefault");
  });
});
