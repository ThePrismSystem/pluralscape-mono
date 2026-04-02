import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type { AccountId, ApiKeyId, SessionId, SystemId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../services/api-key.service.js", () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
}));

const { createApiKey, listApiKeys, revokeApiKey } =
  await import("../../../services/api-key.service.js");

const { apiKeyRouter } = await import("../../../trpc/routers/api-key.js");

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const API_KEY_ID = "ak_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as ApiKeyId;

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
  const appRouter = router({ apiKey: apiKeyRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_API_KEY_RESULT = {
  id: API_KEY_ID,
  systemId: SYSTEM_ID,
  keyType: "metadata" as const,
  scopes: ["read:members"] as const,
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

const VALID_CREATE_INPUT = {
  systemId: SYSTEM_ID,
  keyType: "metadata" as const,
  scopes: ["read:members"] as string[],
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
      const caller = makeCaller();
      const result = await caller.apiKey.create(VALID_CREATE_INPUT);

      expect(vi.mocked(createApiKey)).toHaveBeenCalledOnce();
      expect(vi.mocked(createApiKey).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_CREATE_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(caller.apiKey.create(VALID_CREATE_INPUT)).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = makeCaller();
      await expect(
        caller.apiKey.create({ ...VALID_CREATE_INPUT, systemId: foreignSystemId }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(400) as BAD_REQUEST", async () => {
      vi.mocked(createApiKey).mockRejectedValue(
        new ApiHttpError(400, "VALIDATION_ERROR", "Invalid payload"),
      );
      const caller = makeCaller();
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
      const caller = makeCaller();
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
      const caller = makeCaller();
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
      const caller = makeCaller();
      const result = await caller.apiKey.revoke({ systemId: SYSTEM_ID, apiKeyId: API_KEY_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(revokeApiKey)).toHaveBeenCalledOnce();
      expect(vi.mocked(revokeApiKey).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(revokeApiKey).mock.calls[0]?.[2]).toBe(API_KEY_ID);
    });

    it("rejects invalid apiKeyId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.apiKey.revoke({ systemId: SYSTEM_ID, apiKeyId: "invalid-id" as ApiKeyId }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(revokeApiKey).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "API key not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.apiKey.revoke({ systemId: SYSTEM_ID, apiKeyId: API_KEY_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
