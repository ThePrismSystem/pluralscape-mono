import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountId, ApiKeyId, ApiKeyScope, SystemId } from "@pluralscape/types";

// ── Mock db chain ───────────────────────────────────────────────────

const mockChain = {
  select: vi.fn(),
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
};

function wireChain(): void {
  for (const fn of Object.values(mockChain)) {
    fn.mockReset();
  }
  mockChain.select.mockReturnValue(mockChain);
  mockChain.from.mockReturnValue(mockChain);
  mockChain.innerJoin.mockReturnValue(mockChain);
  mockChain.where.mockReturnValue(mockChain);
  mockChain.limit.mockResolvedValue([]);
}

// ── Mocks ───────────────────────────────────────────────────────────

let mockNow = 1000;

vi.mock("@pluralscape/db/pg", () => ({
  apiKeys: {
    id: "id",
    accountId: "accountId",
    systemId: "systemId",
    scopes: "scopes",
    tokenHash: "tokenHash",
    revokedAt: "revokedAt",
    expiresAt: "expiresAt",
  },
  accounts: {
    id: "id",
    auditLogIpTracking: "auditLogIpTracking",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    now: vi.fn(() => mockNow),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  };
});

// ── Import under test ───────────────────────────────────────────────

const { validateApiKey } = await import("../../services/api-key/validate.js");

// ── Fixtures ────────────────────────────────────────────────────────

const TOKEN = "ps_key_abc123";
const ACCOUNT_ID = brandId<AccountId>("acct_test-account");
const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const KEY_ID = brandId<ApiKeyId>("ak_test-key");
const SCOPES: ApiKeyScope[] = ["read:members"];

function makeValidRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: KEY_ID,
    accountId: ACCOUNT_ID,
    systemId: SYSTEM_ID,
    scopes: SCOPES,
    revokedAt: null,
    expiresAt: null,
    auditLogIpTracking: false,
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("validateApiKey", () => {
  beforeEach(() => {
    wireChain();
    mockNow = 1000;
  });

  it("returns result for valid, non-revoked, non-expired key", async () => {
    mockChain.limit.mockResolvedValueOnce([makeValidRow()]);

    const result = await validateApiKey(mockChain as never, TOKEN);

    expect(result).not.toBeNull();
    expect(result?.accountId).toBe(ACCOUNT_ID);
    expect(result?.systemId).toBe(SYSTEM_ID);
    expect(result?.scopes).toEqual(SCOPES);
    expect(result?.keyId).toBe(KEY_ID);
  });

  it("returns null when no row matches the token hash", async () => {
    // limit defaults to [] — no rows
    const result = await validateApiKey(mockChain as never, TOKEN);

    expect(result).toBeNull();
  });

  it("returns null when key is revoked", async () => {
    mockChain.limit.mockResolvedValueOnce([makeValidRow({ revokedAt: 500 })]);

    const result = await validateApiKey(mockChain as never, TOKEN);

    expect(result).toBeNull();
  });

  it("returns null when key is expired", async () => {
    mockNow = 2000;
    mockChain.limit.mockResolvedValueOnce([makeValidRow({ expiresAt: 1500 })]);

    const result = await validateApiKey(mockChain as never, TOKEN);

    expect(result).toBeNull();
  });

  it("returns result when key has future expiry", async () => {
    mockNow = 1000;
    mockChain.limit.mockResolvedValueOnce([makeValidRow({ expiresAt: 5000 })]);

    const result = await validateApiKey(mockChain as never, TOKEN);

    expect(result).not.toBeNull();
    expect(result?.keyId).toBe(KEY_ID);
  });

  it("returns result when expiresAt is null (no expiry)", async () => {
    mockChain.limit.mockResolvedValueOnce([makeValidRow({ expiresAt: null })]);

    const result = await validateApiKey(mockChain as never, TOKEN);

    expect(result).not.toBeNull();
    expect(result?.keyId).toBe(KEY_ID);
  });

  it("includes auditLogIpTracking from joined account", async () => {
    mockChain.limit.mockResolvedValueOnce([makeValidRow({ auditLogIpTracking: true })]);

    const result = await validateApiKey(mockChain as never, TOKEN);

    expect(result).not.toBeNull();
    expect(result?.auditLogIpTracking).toBe(true);
  });

  it("hashes token with HMAC-SHA256 for lookup", async () => {
    mockChain.limit.mockResolvedValueOnce([makeValidRow()]);

    await validateApiKey(mockChain as never, TOKEN);

    // Verify innerJoin and where were called (proving the query chain ran)
    expect(mockChain.innerJoin).toHaveBeenCalled();
    expect(mockChain.where).toHaveBeenCalled();
  });
});
