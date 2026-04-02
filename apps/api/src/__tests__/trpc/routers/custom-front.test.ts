import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { CustomFrontId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/custom-front.service.js", () => ({
  createCustomFront: vi.fn(),
  getCustomFront: vi.fn(),
  listCustomFronts: vi.fn(),
  updateCustomFront: vi.fn(),
  archiveCustomFront: vi.fn(),
  restoreCustomFront: vi.fn(),
  deleteCustomFront: vi.fn(),
}));

const {
  createCustomFront,
  getCustomFront,
  listCustomFronts,
  updateCustomFront,
  archiveCustomFront,
  restoreCustomFront,
  deleteCustomFront,
} = await import("../../../services/custom-front.service.js");

const { customFrontRouter } = await import("../../../trpc/routers/custom-front.js");

const createCaller = makeCallerFactory({ customFront: customFrontRouter });

const CUSTOM_FRONT_ID = "cf_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as CustomFrontId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JjZg==";

const MOCK_CUSTOM_FRONT_RESULT = {
  id: CUSTOM_FRONT_ID,
  systemId: SYSTEM_ID,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("customFront router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("customFront.create", () => {
    it("calls createCustomFront with correct systemId and returns result", async () => {
      vi.mocked(createCustomFront).mockResolvedValue(MOCK_CUSTOM_FRONT_RESULT);
      const caller = createCaller();
      const result = await caller.customFront.create({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(createCustomFront)).toHaveBeenCalledOnce();
      expect(vi.mocked(createCustomFront).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_CUSTOM_FRONT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.customFront.create({ systemId: SYSTEM_ID, encryptedData: VALID_ENCRYPTED_DATA }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.customFront.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("customFront.get", () => {
    it("calls getCustomFront with correct systemId and customFrontId", async () => {
      vi.mocked(getCustomFront).mockResolvedValue(MOCK_CUSTOM_FRONT_RESULT);
      const caller = createCaller();
      const result = await caller.customFront.get({
        systemId: SYSTEM_ID,
        customFrontId: CUSTOM_FRONT_ID,
      });

      expect(vi.mocked(getCustomFront)).toHaveBeenCalledOnce();
      expect(vi.mocked(getCustomFront).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getCustomFront).mock.calls[0]?.[2]).toBe(CUSTOM_FRONT_ID);
      expect(result).toEqual(MOCK_CUSTOM_FRONT_RESULT);
    });

    it("rejects invalid customFrontId format", async () => {
      const caller = createCaller();
      await expect(
        caller.customFront.get({
          systemId: SYSTEM_ID,
          customFrontId: "not-a-custom-front-id" as CustomFrontId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getCustomFront).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Custom front not found"),
      );
      const caller = createCaller();
      await expect(
        caller.customFront.get({ systemId: SYSTEM_ID, customFrontId: CUSTOM_FRONT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("customFront.list", () => {
    it("calls listCustomFronts and returns result", async () => {
      const mockResult = {
        data: [MOCK_CUSTOM_FRONT_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listCustomFronts).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.customFront.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listCustomFronts)).toHaveBeenCalledOnce();
      expect(vi.mocked(listCustomFronts).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor and limit", async () => {
      vi.mocked(listCustomFronts).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.customFront.list({ systemId: SYSTEM_ID, cursor: "cur_abc", limit: 10 });

      expect(vi.mocked(listCustomFronts).mock.calls[0]?.[3]).toBe("cur_abc");
      expect(vi.mocked(listCustomFronts).mock.calls[0]?.[4]).toBe(10);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("customFront.update", () => {
    it("calls updateCustomFront with correct systemId and customFrontId", async () => {
      vi.mocked(updateCustomFront).mockResolvedValue(MOCK_CUSTOM_FRONT_RESULT);
      const caller = createCaller();
      const result = await caller.customFront.update({
        systemId: SYSTEM_ID,
        customFrontId: CUSTOM_FRONT_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateCustomFront)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateCustomFront).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(updateCustomFront).mock.calls[0]?.[2]).toBe(CUSTOM_FRONT_ID);
      expect(result).toEqual(MOCK_CUSTOM_FRONT_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateCustomFront).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.customFront.update({
          systemId: SYSTEM_ID,
          customFrontId: CUSTOM_FRONT_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("customFront.archive", () => {
    it("calls archiveCustomFront and returns success", async () => {
      vi.mocked(archiveCustomFront).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.customFront.archive({
        systemId: SYSTEM_ID,
        customFrontId: CUSTOM_FRONT_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveCustomFront)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveCustomFront).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveCustomFront).mock.calls[0]?.[2]).toBe(CUSTOM_FRONT_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveCustomFront).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Custom front not found"),
      );
      const caller = createCaller();
      await expect(
        caller.customFront.archive({ systemId: SYSTEM_ID, customFrontId: CUSTOM_FRONT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("customFront.restore", () => {
    it("calls restoreCustomFront and returns result", async () => {
      vi.mocked(restoreCustomFront).mockResolvedValue(MOCK_CUSTOM_FRONT_RESULT);
      const caller = createCaller();
      const result = await caller.customFront.restore({
        systemId: SYSTEM_ID,
        customFrontId: CUSTOM_FRONT_ID,
      });

      expect(vi.mocked(restoreCustomFront)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreCustomFront).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreCustomFront).mock.calls[0]?.[2]).toBe(CUSTOM_FRONT_ID);
      expect(result).toEqual(MOCK_CUSTOM_FRONT_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreCustomFront).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Custom front not found"),
      );
      const caller = createCaller();
      await expect(
        caller.customFront.restore({ systemId: SYSTEM_ID, customFrontId: CUSTOM_FRONT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("customFront.delete", () => {
    it("calls deleteCustomFront and returns success", async () => {
      vi.mocked(deleteCustomFront).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.customFront.delete({
        systemId: SYSTEM_ID,
        customFrontId: CUSTOM_FRONT_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteCustomFront)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteCustomFront).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteCustomFront).mock.calls[0]?.[2]).toBe(CUSTOM_FRONT_ID);
    });

    it("surfaces ApiHttpError(409) as CONFLICT when has dependents", async () => {
      vi.mocked(deleteCustomFront).mockRejectedValue(
        new ApiHttpError(409, "HAS_DEPENDENTS", "Custom front has fronting sessions"),
      );
      const caller = createCaller();
      await expect(
        caller.customFront.delete({ systemId: SYSTEM_ID, customFrontId: CUSTOM_FRONT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteCustomFront).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Custom front not found"),
      );
      const caller = createCaller();
      await expect(
        caller.customFront.delete({ systemId: SYSTEM_ID, customFrontId: CUSTOM_FRONT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(listCustomFronts).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await caller.customFront.list({ systemId: SYSTEM_ID });
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalled();
    const callKey = vi.mocked(checkRateLimit).mock.calls[0]?.[0] as string;
    expect(callKey).toContain("readDefault");
  });
});
