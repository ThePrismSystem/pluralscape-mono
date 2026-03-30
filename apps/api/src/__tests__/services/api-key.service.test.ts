import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTestAuth } from "../helpers/test-auth.js";

import type { ApiKeyId, SystemId } from "@pluralscape/types";

// ── Mock tx chain ─────────────────────────────────────────────────

const mockTx = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
};

function wireChain(): void {
  // Reset call history and implementations before re-wiring
  for (const fn of Object.values(mockTx)) {
    fn.mockReset();
  }
  mockTx.select.mockReturnValue(mockTx);
  mockTx.from.mockReturnValue(mockTx);
  mockTx.where.mockReturnValue(mockTx);
  mockTx.orderBy.mockReturnValue(mockTx);
  mockTx.limit.mockResolvedValue([]);
  mockTx.insert.mockReturnValue(mockTx);
  mockTx.values.mockReturnValue(mockTx);
  mockTx.returning.mockResolvedValue([]);
  mockTx.update.mockReturnValue(mockTx);
  mockTx.set.mockReturnValue(mockTx);
}

// ── Mocks ─────────────────────────────────────────────────────────

const SYSTEM_ID = "sys_test-system" as SystemId;
const API_KEY_ID = "ak_test-key" as ApiKeyId;

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

vi.mock("../../lib/encrypted-blob.js", () => ({
  validateEncryptedBlob: vi.fn(() => ({
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    nonce: new Uint8Array(24),
    ciphertext: new Uint8Array(16),
  })),
}));

vi.mock("@pluralscape/db/pg", () => ({
  apiKeys: {
    id: "id",
    accountId: "accountId",
    systemId: "systemId",
    keyType: "keyType",
    tokenHash: "tokenHash",
    scopes: "scopes",
    encryptedData: "encryptedData",
    encryptedKeyMaterial: "encryptedKeyMaterial",
    createdAt: "createdAt",
    lastUsedAt: "lastUsedAt",
    revokedAt: "revokedAt",
    expiresAt: "expiresAt",
    scopedBucketIds: "scopedBucketIds",
  },
}));

// ── Imports after mocks ───────────────────────────────────────────

const { createApiKey, listApiKeys, getApiKey, revokeApiKey } =
  await import("../../services/api-key.service.js");

// ── Fixtures ──────────────────────────────────────────────────────

const AUTH = makeTestAuth({
  accountId: "acct_test-account",
  systemId: SYSTEM_ID,
  sessionId: "sess_test-session",
});

const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");

function makeApiKeyRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: API_KEY_ID,
    systemId: SYSTEM_ID,
    keyType: "metadata",
    scopes: ["read:members"],
    createdAt: 1000,
    lastUsedAt: null,
    revokedAt: null,
    expiresAt: null,
    scopedBucketIds: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("createApiKey", () => {
  beforeEach(() => {
    wireChain();
    mockAudit.mockClear();
  });

  it("succeeds with valid metadata key body", async () => {
    const row = makeApiKeyRow();
    mockTx.returning.mockResolvedValueOnce([row]);

    const result = await createApiKey(
      {} as never,
      SYSTEM_ID,
      {
        keyType: "metadata",
        scopes: ["read:members"],
        encryptedData: VALID_BLOB_BASE64,
      },
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(API_KEY_ID);
    expect(result.keyType).toBe("metadata");
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    expect(mockAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ eventType: "api-key.created" }),
    );
  });

  it("throws VALIDATION_ERROR for invalid keyType", async () => {
    await expect(
      createApiKey(
        {} as never,
        SYSTEM_ID,
        {
          keyType: "invalid_type",
          scopes: ["read:members"],
          encryptedData: VALID_BLOB_BASE64,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("coalesces expiresAt to null when absent", async () => {
    const row = makeApiKeyRow({ expiresAt: null });
    mockTx.returning.mockResolvedValueOnce([row]);

    const result = await createApiKey(
      {} as never,
      SYSTEM_ID,
      {
        keyType: "metadata",
        scopes: ["read:members"],
        encryptedData: VALID_BLOB_BASE64,
      },
      AUTH,
      mockAudit,
    );

    expect(result.expiresAt).toBeNull();
  });

  it("passes expiresAt through when provided", async () => {
    const row = makeApiKeyRow({ expiresAt: 9999 });
    mockTx.returning.mockResolvedValueOnce([row]);

    const result = await createApiKey(
      {} as never,
      SYSTEM_ID,
      {
        keyType: "metadata",
        scopes: ["read:members"],
        encryptedData: VALID_BLOB_BASE64,
        expiresAt: 9999,
      },
      AUTH,
      mockAudit,
    );

    expect(result.expiresAt).toBe(9999);
  });

  it("coalesces scopedBucketIds to null when absent", async () => {
    const row = makeApiKeyRow({ scopedBucketIds: null });
    mockTx.returning.mockResolvedValueOnce([row]);

    const result = await createApiKey(
      {} as never,
      SYSTEM_ID,
      {
        keyType: "metadata",
        scopes: ["read:members"],
        encryptedData: VALID_BLOB_BASE64,
      },
      AUTH,
      mockAudit,
    );

    expect(result.scopedBucketIds).toBeNull();
  });

  it("passes scopedBucketIds through when provided", async () => {
    const row = makeApiKeyRow({ scopedBucketIds: ["bkt_1", "bkt_2"] });
    mockTx.returning.mockResolvedValueOnce([row]);

    const result = await createApiKey(
      {} as never,
      SYSTEM_ID,
      {
        keyType: "metadata",
        scopes: ["read:members"],
        encryptedData: VALID_BLOB_BASE64,
        scopedBucketIds: ["bkt_1", "bkt_2"],
      },
      AUTH,
      mockAudit,
    );

    expect(result.scopedBucketIds).toEqual(["bkt_1", "bkt_2"]);
  });

  it("stores encryptedKeyMaterial for crypto keys", async () => {
    const row = makeApiKeyRow({ keyType: "crypto" });
    mockTx.returning.mockResolvedValueOnce([row]);

    const result = await createApiKey(
      {} as never,
      SYSTEM_ID,
      {
        keyType: "crypto",
        scopes: ["read:members"],
        encryptedData: VALID_BLOB_BASE64,
        encryptedKeyMaterial: Buffer.from("key-material").toString("base64"),
      },
      AUTH,
      mockAudit,
    );

    expect(result.keyType).toBe("crypto");
    // Verify values() was called with encryptedKeyMaterial as Buffer
    const valuesCall = mockTx.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(valuesCall.encryptedKeyMaterial).toBeInstanceOf(Buffer);
  });

  it("sets encryptedKeyMaterial to null for metadata keys", async () => {
    const row = makeApiKeyRow();
    mockTx.returning.mockResolvedValueOnce([row]);

    await createApiKey(
      {} as never,
      SYSTEM_ID,
      {
        keyType: "metadata",
        scopes: ["read:members"],
        encryptedData: VALID_BLOB_BASE64,
      },
      AUTH,
      mockAudit,
    );

    const valuesCall = mockTx.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(valuesCall.encryptedKeyMaterial).toBeNull();
  });

  it("throws when INSERT returns no rows", async () => {
    mockTx.returning.mockResolvedValueOnce([]);

    await expect(
      createApiKey(
        {} as never,
        SYSTEM_ID,
        {
          keyType: "metadata",
          scopes: ["read:members"],
          encryptedData: VALID_BLOB_BASE64,
        },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow("Failed to create API key");
  });
});

// ── listApiKeys ───────────────────────────────────────────────────

describe("listApiKeys", () => {
  beforeEach(() => {
    wireChain();
  });

  it("returns paginated results with defaults", async () => {
    const row = makeApiKeyRow();
    mockTx.limit.mockResolvedValueOnce([row]);

    const result = await listApiKeys({} as never, SYSTEM_ID, AUTH);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(API_KEY_ID);
    expect(result.hasMore).toBe(false);
  });

  it("applies cursor filter when provided", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    await listApiKeys({} as never, SYSTEM_ID, AUTH, { cursor: "ak_cursor-id" });

    // where() called with conditions that include cursor filter
    expect(mockTx.where).toHaveBeenCalled();
  });

  it("includes revoked keys when includeRevoked is true", async () => {
    const activeRow = makeApiKeyRow();
    const revokedRow = makeApiKeyRow({ id: "ak_revoked", revokedAt: 2000 });
    mockTx.limit.mockResolvedValueOnce([activeRow, revokedRow]);

    const result = await listApiKeys({} as never, SYSTEM_ID, AUTH, { includeRevoked: true });

    expect(result.items).toHaveLength(2);
  });

  it("uses custom limit", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    await listApiKeys({} as never, SYSTEM_ID, AUTH, { limit: 5 });

    // limit() is called with effectiveLimit + 1 = 6
    expect(mockTx.limit).toHaveBeenCalledWith(6);
  });

  it("clamps limit to MAX_PAGE_LIMIT", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    await listApiKeys({} as never, SYSTEM_ID, AUTH, { limit: 9999 });

    // MAX_PAGE_LIMIT is 100, so limit(101)
    expect(mockTx.limit).toHaveBeenCalledWith(101);
  });

  it("detects hasMore when rows exceed limit", async () => {
    // Return limit+1 rows to trigger hasMore
    const rows = Array.from({ length: 26 }, (_, i) => makeApiKeyRow({ id: `ak_key-${String(i)}` }));
    mockTx.limit.mockResolvedValueOnce(rows);

    const result = await listApiKeys({} as never, SYSTEM_ID, AUTH);

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(25);
    expect(result.nextCursor).not.toBeNull();
  });
});

// ── getApiKey ─────────────────────────────────────────────────────

describe("getApiKey", () => {
  beforeEach(() => {
    wireChain();
  });

  it("returns key when found", async () => {
    const row = makeApiKeyRow();
    mockTx.limit.mockResolvedValueOnce([row]);

    const result = await getApiKey({} as never, SYSTEM_ID, API_KEY_ID, AUTH);

    expect(result.id).toBe(API_KEY_ID);
    expect(result.systemId).toBe(SYSTEM_ID);
  });

  it("throws NOT_FOUND when key does not exist", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    await expect(
      getApiKey({} as never, SYSTEM_ID, "ak_nonexistent" as ApiKeyId, AUTH),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});

// ── revokeApiKey ──────────────────────────────────────────────────

describe("revokeApiKey", () => {
  beforeEach(() => {
    wireChain();
    mockAudit.mockClear();
  });

  it("revokes an active key", async () => {
    mockTx.limit.mockResolvedValueOnce([{ id: API_KEY_ID, revokedAt: null }]);

    await revokeApiKey({} as never, SYSTEM_ID, API_KEY_ID, AUTH, mockAudit);

    expect(mockTx.update).toHaveBeenCalled();
    expect(mockAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ eventType: "api-key.revoked" }),
    );
  });

  it("is idempotent for already revoked keys", async () => {
    mockTx.limit.mockResolvedValueOnce([{ id: API_KEY_ID, revokedAt: 2000 }]);

    await revokeApiKey({} as never, SYSTEM_ID, API_KEY_ID, AUTH, mockAudit);

    // update should NOT be called when key is already revoked
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when key does not exist", async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    await expect(
      revokeApiKey({} as never, SYSTEM_ID, "ak_nonexistent" as ApiKeyId, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });
});
