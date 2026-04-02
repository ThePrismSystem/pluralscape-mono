import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { ApiKeyId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/api-key.service.js", () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
}));

const { createApiKey, listApiKeys, revokeApiKey } =
  await import("../../../services/api-key.service.js");

const { apiKeyRouter } = await import("../../../trpc/routers/api-key.js");

const createCaller = makeCallerFactory({ apiKey: apiKeyRouter });

const API_KEY_ID = "ak_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as ApiKeyId;

const MOCK_API_KEY_RESULT = {
  id: API_KEY_ID,
  systemId: SYSTEM_ID,
  keyType: "metadata" as const,
  scopes: ["read:members" as const],
  createdAt: 1_700_000_000_000 as UnixMillis,
  lastUsedAt: null,
  revokedAt: null,
  expiresAt: null,
  scopedBucketIds: null,
};

const MOCK_CREATE_RESULT = {
  ...MOCK_API_KEY_RESULT,
  token: "deadbeef01234567",
};

const SCOPES = ["read:members" as const];

const VALID_CREATE_INPUT = {
  systemId: SYSTEM_ID,
  keyType: "metadata" as const,
  scopes: SCOPES,
  encryptedData: "dGVzdGRhdGFmb3JrZXk=",
};

describe("apiKey router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("apiKey.create", () => {
    it("calls createApiKey with correct systemId and returns result", async () => {
      vi.mocked(createApiKey).mockResolvedValue(MOCK_CREATE_RESULT);
      const caller = createCaller();
      const result = await caller.apiKey.create(VALID_CREATE_INPUT);

      expect(vi.mocked(createApiKey)).toHaveBeenCalledOnce();
      expect(vi.mocked(createApiKey).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_CREATE_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.apiKey.create(VALID_CREATE_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.apiKey.create({ ...VALID_CREATE_INPUT, systemId: foreignSystemId }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(createApiKey).mockRejectedValue(
        new ApiHttpError(400, "VALIDATION_ERROR", "Invalid payload"),
      );
      const caller = createCaller();
      await expect(caller.apiKey.create(VALID_CREATE_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("apiKey.list", () => {
    it("calls listApiKeys and returns result", async () => {
      const mockResult = {
        data: [MOCK_API_KEY_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listApiKeys).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.apiKey.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listApiKeys)).toHaveBeenCalledOnce();
      expect(vi.mocked(listApiKeys).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeRevoked as opts", async () => {
      vi.mocked(listApiKeys).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.apiKey.list({
        systemId: SYSTEM_ID,
        cursor: "ak_cursor",
        limit: 5,
        includeRevoked: true,
      });

      const opts = vi.mocked(listApiKeys).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("ak_cursor");
      expect(opts?.limit).toBe(5);
      expect(opts?.includeRevoked).toBe(true);
    });
  });

  // ── revoke ────────────────────────────────────────────────────────

  describe("apiKey.revoke", () => {
    it("calls revokeApiKey and returns success", async () => {
      vi.mocked(revokeApiKey).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.apiKey.revoke({ systemId: SYSTEM_ID, apiKeyId: API_KEY_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(revokeApiKey)).toHaveBeenCalledOnce();
      expect(vi.mocked(revokeApiKey).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(revokeApiKey).mock.calls[0]?.[2]).toBe(API_KEY_ID);
    });

    it("rejects invalid apiKeyId format", async () => {
      const caller = createCaller();
      await expect(
        caller.apiKey.revoke({ systemId: SYSTEM_ID, apiKeyId: "invalid-id" as ApiKeyId }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(revokeApiKey).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "API key not found"),
      );
      const caller = createCaller();
      await expect(
        caller.apiKey.revoke({ systemId: SYSTEM_ID, apiKeyId: API_KEY_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(listApiKeys).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await caller.apiKey.list({ systemId: SYSTEM_ID });
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalled();
    const callKey = vi.mocked(checkRateLimit).mock.calls[0]?.[0] as string;
    expect(callKey).toContain("readDefault");
  });
});
