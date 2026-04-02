import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { DeviceTokenId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/device-token.service.js", () => ({
  registerDeviceToken: vi.fn(),
  listDeviceTokens: vi.fn(),
  revokeDeviceToken: vi.fn(),
  deleteDeviceToken: vi.fn(),
}));

const { registerDeviceToken, listDeviceTokens, revokeDeviceToken, deleteDeviceToken } =
  await import("../../../services/device-token.service.js");

const { deviceTokenRouter } = await import("../../../trpc/routers/device-token.js");

const createCaller = makeCallerFactory({ deviceToken: deviceTokenRouter });

const TOKEN_ID = "dt_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as DeviceTokenId;

const MOCK_TOKEN_RESULT = {
  id: TOKEN_ID,
  systemId: SYSTEM_ID,
  platform: "ios" as const,
  token: "***abc123",
  lastActiveAt: 1_700_000_000_000 as UnixMillis,
  createdAt: 1_700_000_000_000 as UnixMillis,
};

describe("deviceToken router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── register ─────────────────────────────────────────────────────────

  describe("deviceToken.register", () => {
    it("calls registerDeviceToken with correct systemId and params", async () => {
      vi.mocked(registerDeviceToken).mockResolvedValue(MOCK_TOKEN_RESULT);
      const caller = createCaller();
      const result = await caller.deviceToken.register({
        systemId: SYSTEM_ID,
        platform: "ios",
        token: "device-push-token-abc123",
      });

      expect(vi.mocked(registerDeviceToken)).toHaveBeenCalledOnce();
      expect(vi.mocked(registerDeviceToken).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_TOKEN_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.deviceToken.register({
          systemId: SYSTEM_ID,
          platform: "ios",
          token: "device-push-token-abc123",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.deviceToken.register({
          systemId: foreignSystemId,
          platform: "ios",
          token: "device-push-token-abc123",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("deviceToken.list", () => {
    it("calls listDeviceTokens and returns paginated result", async () => {
      const mockResult = {
        data: [MOCK_TOKEN_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listDeviceTokens).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.deviceToken.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listDeviceTokens)).toHaveBeenCalledOnce();
      expect(vi.mocked(listDeviceTokens).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor and limit opts to service", async () => {
      vi.mocked(listDeviceTokens).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.deviceToken.list({ systemId: SYSTEM_ID, cursor: "cursor_xyz", limit: 5 });

      const opts = vi.mocked(listDeviceTokens).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cursor_xyz");
      expect(opts?.limit).toBe(5);
    });
  });

  // ── revoke ───────────────────────────────────────────────────────────

  describe("deviceToken.revoke", () => {
    it("calls revokeDeviceToken and returns success", async () => {
      vi.mocked(revokeDeviceToken).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.deviceToken.revoke({ systemId: SYSTEM_ID, tokenId: TOKEN_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(revokeDeviceToken)).toHaveBeenCalledOnce();
      expect(vi.mocked(revokeDeviceToken).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(revokeDeviceToken).mock.calls[0]?.[2]).toBe(TOKEN_ID);
    });

    it("rejects invalid tokenId format", async () => {
      const caller = createCaller();
      await expect(
        caller.deviceToken.revoke({
          systemId: SYSTEM_ID,
          tokenId: "not-a-token-id" as DeviceTokenId,
        }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(revokeDeviceToken).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Device token not found"),
      );
      const caller = createCaller();
      await expect(
        caller.deviceToken.revoke({ systemId: SYSTEM_ID, tokenId: TOKEN_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ───────────────────────────────────────────────────────────

  describe("deviceToken.delete", () => {
    it("calls deleteDeviceToken and returns success", async () => {
      vi.mocked(deleteDeviceToken).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.deviceToken.delete({ systemId: SYSTEM_ID, tokenId: TOKEN_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteDeviceToken)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteDeviceToken).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteDeviceToken).mock.calls[0]?.[2]).toBe(TOKEN_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteDeviceToken).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Device token not found"),
      );
      const caller = createCaller();
      await expect(
        caller.deviceToken.delete({ systemId: SYSTEM_ID, tokenId: TOKEN_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
