import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_AUTH, makeCallerFactory, assertProcedureRateLimited } from "../test-helpers.js";

import type { FriendCodeId, FriendConnectionId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/friend-code.service.js", () => ({
  generateFriendCode: vi.fn(),
  listFriendCodes: vi.fn(),
  redeemFriendCode: vi.fn(),
  archiveFriendCode: vi.fn(),
}));

const { generateFriendCode, listFriendCodes, redeemFriendCode, archiveFriendCode } =
  await import("../../../services/friend-code.service.js");

const { friendCodeRouter } = await import("../../../trpc/routers/friend-code.js");

const createCaller = makeCallerFactory({ friendCode: friendCodeRouter });

const CODE_ID = "frc_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as FriendCodeId;
const CONNECTION_ID_A = "fc_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as FriendConnectionId;
const CONNECTION_ID_B = "fc_ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee" as FriendConnectionId;

const MOCK_CODE_RESULT = {
  id: CODE_ID,
  accountId: MOCK_AUTH.accountId,
  code: "ABCD-EFGH",
  createdAt: 1_700_000_000_000 as UnixMillis,
  expiresAt: null,
  archived: false,
};

describe("friendCode router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── generate ─────────────────────────────────────────────────────────

  describe("friendCode.generate", () => {
    it("calls generateFriendCode and returns the result", async () => {
      vi.mocked(generateFriendCode).mockResolvedValue(MOCK_CODE_RESULT);
      const caller = createCaller();
      const result = await caller.friendCode.generate();

      expect(vi.mocked(generateFriendCode)).toHaveBeenCalledOnce();
      expect(vi.mocked(generateFriendCode).mock.calls[0]?.[1]).toBe(MOCK_AUTH.accountId);
      expect(result).toEqual(MOCK_CODE_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.friendCode.generate()).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("friendCode.list", () => {
    it("calls listFriendCodes and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_CODE_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listFriendCodes).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.friendCode.list({});

      expect(vi.mocked(listFriendCodes)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFriendCodes).mock.calls[0]?.[1]).toBe(MOCK_AUTH.accountId);
      expect(vi.mocked(listFriendCodes).mock.calls[0]?.[2]).toBe(MOCK_AUTH);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor and limit to service", async () => {
      vi.mocked(listFriendCodes).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.friendCode.list({ cursor: "abc", limit: 5 });

      expect(vi.mocked(listFriendCodes).mock.calls[0]?.[3]).toBe("abc");
      expect(vi.mocked(listFriendCodes).mock.calls[0]?.[4]).toBe(5);
    });

    it("converts null cursor to undefined", async () => {
      vi.mocked(listFriendCodes).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.friendCode.list({ cursor: null });

      expect(vi.mocked(listFriendCodes).mock.calls[0]?.[3]).toBeUndefined();
    });
  });

  // ── redeem ───────────────────────────────────────────────────────────

  describe("friendCode.redeem", () => {
    it("calls redeemFriendCode and returns the result", async () => {
      const mockResult = { connectionIds: [CONNECTION_ID_A, CONNECTION_ID_B] as const };
      vi.mocked(redeemFriendCode).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.friendCode.redeem({ code: "ABCD-EFGH" });

      expect(vi.mocked(redeemFriendCode)).toHaveBeenCalledOnce();
      expect(vi.mocked(redeemFriendCode).mock.calls[0]?.[1]).toBe("ABCD-EFGH");
      expect(result).toEqual(mockResult);
    });

    it("rejects invalid code format", async () => {
      const caller = createCaller();
      await expect(caller.friendCode.redeem({ code: "not-a-code" })).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });

  // ── archive ──────────────────────────────────────────────────────────

  describe("friendCode.archive", () => {
    it("calls archiveFriendCode and returns success", async () => {
      vi.mocked(archiveFriendCode).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.friendCode.archive({ codeId: CODE_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveFriendCode)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveFriendCode).mock.calls[0]?.[2]).toBe(CODE_ID);
    });

    it("rejects invalid codeId format", async () => {
      const caller = createCaller();
      await expect(
        caller.friendCode.archive({ codeId: "not-a-code-id" as FriendCodeId }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── rate limiting ───────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listFriendCodes).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.friendCode.list({}),
      "readDefault",
    );
  });

  it("applies rate limiting to generate (write)", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(generateFriendCode).mockResolvedValue(MOCK_CODE_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.friendCode.generate(),
      "write",
    );
  });

  it("applies friendCodeRedeem rate limiting to redeem", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(redeemFriendCode).mockResolvedValue({
      connectionIds: [CONNECTION_ID_A, CONNECTION_ID_B] as const,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.friendCode.redeem({ code: "ABCD-EFGH" }),
      "friendCodeRedeem",
    );
  });
});
