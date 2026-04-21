import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { DeviceTokenId, DeviceTokenPlatform, SystemId } from "@pluralscape/types";

// ── Mock tx ──────────────────────────────────────────────────────────

const mockTx = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  orderBy: vi.fn(),
  onConflictDoUpdate: vi.fn(),
};

function wireChain(): void {
  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.where.mockReturnValue(mockTx);
  mockTx.limit.mockResolvedValue([]);
  mockTx.insert.mockReturnValue(mockTx);
  mockTx.values.mockReturnValue(mockTx);
  mockTx.onConflictDoUpdate.mockReturnValue(mockTx);
  mockTx.returning.mockResolvedValue([]);
  mockTx.update.mockReturnValue(mockTx);
  mockTx.set.mockReturnValue(mockTx);
  mockTx.delete.mockReturnValue(mockTx);
  mockTx.orderBy.mockReturnValue(mockTx);
}

// ── Mocks ────────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../lib/rls-context.js", () => ({
  withTenantTransaction: vi.fn(
    (_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  ),
  withTenantRead: vi.fn((_db: unknown, _ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockTx),
  ),
}));

vi.mock("../../lib/tenant-context.js", () => ({
  tenantCtx: vi.fn(() => ({ systemId: SYSTEM_ID, accountId: "acct_test" })),
}));

vi.mock("../../lib/session-token.js", () => ({
  hashSessionToken: vi.fn((token: string) => `hashed_${token}`),
}));

vi.mock("@pluralscape/db/pg", () => ({
  deviceTokens: {
    id: "id",
    accountId: "account_id",
    systemId: "system_id",
    platform: "platform",
    tokenHash: "token_hash",
    createdAt: "created_at",
    lastActiveAt: "last_active_at",
    revokedAt: "revoked_at",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("dt_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    lt: vi.fn((a: unknown, b: unknown) => ["lt", a, b]),
    desc: vi.fn((a: unknown) => ["desc", a]),
    isNull: vi.fn((a: unknown) => ["isNull", a]),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");

const { registerDeviceToken } = await import("../../services/device-token/register.js");
const { updateDeviceToken } = await import("../../services/device-token/update.js");
const { deleteDeviceToken } = await import("../../services/device-token/delete.js");
const { revokeDeviceToken } = await import("../../services/device-token/revoke.js");
const { listDeviceTokens } = await import("../../services/device-token/queries.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const TOKEN_ID = brandId<DeviceTokenId>("dt_test-token");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);
const PLATFORM: DeviceTokenPlatform = "ios";
const TOKEN_VALUE = "abcdef1234567890abcdef1234567890";
const TOKEN_HASH = `hashed_${TOKEN_VALUE}`;

function makeTokenRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: TOKEN_ID,
    accountId: AUTH.accountId,
    systemId: SYSTEM_ID,
    platform: PLATFORM,
    tokenHash: TOKEN_HASH,
    createdAt: 1000,
    lastActiveAt: 1000,
    revokedAt: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("device-token service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
    wireChain();
  });

  wireChain();

  // ── registerDeviceToken ───────────────────────────────────────────

  describe("registerDeviceToken", () => {
    const params = { platform: PLATFORM, token: TOKEN_VALUE };

    it("registers and returns hashed token result", async () => {
      mockTx.returning.mockResolvedValueOnce([makeTokenRow()]);

      const result = await registerDeviceToken({} as never, SYSTEM_ID, params, AUTH, mockAudit);

      expect(result.id).toBe(TOKEN_ID);
      expect(result.platform).toBe(PLATFORM);
      expect(result.tokenHash).toBe(TOKEN_HASH);
      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ eventType: "device-token.registered" }),
      );
    });

    it("returns synthetic result when conflict belongs to another account", async () => {
      // No row returned means conflict existed but accountId didn't match
      mockTx.returning.mockResolvedValueOnce([]);

      const result = await registerDeviceToken({} as never, SYSTEM_ID, params, AUTH, mockAudit);

      expect(result.systemId).toBe(SYSTEM_ID);
      expect(result.platform).toBe(PLATFORM);
      expect(result.tokenHash).toBe(TOKEN_HASH);
      // Should NOT write audit for a no-op
      expect(mockAudit).not.toHaveBeenCalled();
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        registerDeviceToken({} as never, SYSTEM_ID, params, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  // ── updateDeviceToken ─────────────────────────────────────────────

  describe("updateDeviceToken", () => {
    it("updates token with all fields provided", async () => {
      const newHash = "hashed_newtoken1234567890newtoken26789012";
      mockTx.returning.mockResolvedValueOnce([
        makeTokenRow({ platform: "android", tokenHash: newHash }),
      ]);

      const result = await updateDeviceToken(
        {} as never,
        SYSTEM_ID,
        TOKEN_ID,
        { platform: "android", token: "newtoken1234567890newtoken26789012" },
        AUTH,
        mockAudit,
      );

      expect(result.platform).toBe("android");
      expect(result.tokenHash).toBe(newHash);
      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ eventType: "device-token.updated" }),
      );
    });

    it("merges only provided fields (platform only)", async () => {
      mockTx.returning.mockResolvedValueOnce([makeTokenRow({ platform: "android" })]);

      const result = await updateDeviceToken(
        {} as never,
        SYSTEM_ID,
        TOKEN_ID,
        { platform: "android" },
        AUTH,
        mockAudit,
      );

      expect(result.platform).toBe("android");
      expect(mockAudit).toHaveBeenCalled();
    });

    it("merges only provided fields (token only)", async () => {
      const newToken = "replacement_token_value_1234567890";
      const newHash = `hashed_${newToken}`;
      mockTx.returning.mockResolvedValueOnce([makeTokenRow({ tokenHash: newHash })]);

      const result = await updateDeviceToken(
        {} as never,
        SYSTEM_ID,
        TOKEN_ID,
        { token: newToken },
        AUTH,
        mockAudit,
      );

      expect(result.tokenHash).toBe(newHash);
      expect(mockAudit).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when token does not exist", async () => {
      // UPDATE … RETURNING returns empty — token not found or revoked
      mockTx.returning.mockResolvedValueOnce([]);

      await expect(
        updateDeviceToken(
          {} as never,
          SYSTEM_ID,
          TOKEN_ID,
          { platform: "android" },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        updateDeviceToken(
          {} as never,
          SYSTEM_ID,
          TOKEN_ID,
          { platform: "android" },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  // ── deleteDeviceToken ────────────────────────────────────────────

  describe("deleteDeviceToken", () => {
    it("deletes token and writes audit", async () => {
      mockTx.returning.mockResolvedValueOnce([{ id: TOKEN_ID }]);

      await deleteDeviceToken({} as never, SYSTEM_ID, TOKEN_ID, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ eventType: "device-token.deleted" }),
      );
    });

    it("throws NOT_FOUND when token does not exist", async () => {
      mockTx.returning.mockResolvedValueOnce([]);

      await expect(
        deleteDeviceToken({} as never, SYSTEM_ID, TOKEN_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        deleteDeviceToken({} as never, SYSTEM_ID, TOKEN_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  // ── revokeDeviceToken ─────────────────────────────────────────────

  describe("revokeDeviceToken", () => {
    it("revokes token and writes audit", async () => {
      mockTx.returning.mockResolvedValueOnce([{ id: TOKEN_ID }]);

      await revokeDeviceToken({} as never, SYSTEM_ID, TOKEN_ID, AUTH, mockAudit);

      expect(mockAudit).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ eventType: "device-token.revoked" }),
      );
    });

    it("throws NOT_FOUND when token does not exist or is already revoked", async () => {
      mockTx.returning.mockResolvedValueOnce([]);

      await expect(
        revokeDeviceToken({} as never, SYSTEM_ID, TOKEN_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(
        revokeDeviceToken({} as never, SYSTEM_ID, TOKEN_ID, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 404 }));
    });
  });

  // ── listDeviceTokens ──────────────────────────────────────────────

  describe("listDeviceTokens", () => {
    it("returns paginated result with hashed tokens", async () => {
      mockTx.limit.mockResolvedValueOnce([makeTokenRow(), makeTokenRow({ id: "dt_other" })]);

      const result = await listDeviceTokens({} as never, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
      expect(result.data[0]?.tokenHash).toBe(TOKEN_HASH);
    });

    it("sets hasMore and nextCursor when more items exist", async () => {
      // limit defaults to 25, so returning 26 rows signals hasMore
      const rows = Array.from({ length: 26 }, (_, i) =>
        makeTokenRow({ id: `dt_${String(i).padStart(4, "0")}` }),
      );
      mockTx.limit.mockResolvedValueOnce(rows);

      const result = await listDeviceTokens({} as never, SYSTEM_ID, AUTH);

      expect(result.data).toHaveLength(25);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it("returns empty paginated result when no tokens", async () => {
      mockTx.limit.mockResolvedValueOnce([]);

      const result = await listDeviceTokens({} as never, SYSTEM_ID, AUTH);
      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("rejects when ownership check fails", async () => {
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listDeviceTokens({} as never, SYSTEM_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404 }),
      );
    });
  });
});
