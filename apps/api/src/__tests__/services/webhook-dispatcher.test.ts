import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberId, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

const mockInsertValues = vi.fn();
const mockWhere = vi.fn();

const mockDb = {
  // rollback signals to isTransaction() that this is a transaction handle
  rollback: vi.fn(),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: mockWhere,
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: mockInsertValues,
  }),
};

/** Mock db WITHOUT rollback — simulates a raw (non-transaction) handle for cache tests. */
const mockRawDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: mockWhere,
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: mockInsertValues,
  }),
  transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
};

const mockGetKey = vi.fn().mockReturnValue(null);
const mockEncrypt = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]));

vi.mock("../../services/webhook-payload-encryption.js", () => ({
  getWebhookPayloadEncryptionKey: mockGetKey,
  encryptWebhookPayload: mockEncrypt,
}));

const mockMemzero = vi.fn();
vi.mock("@pluralscape/crypto", async () => {
  const actual = await vi.importActual("@pluralscape/crypto");
  return { ...actual, getSodium: vi.fn().mockReturnValue({ memzero: mockMemzero }) };
});

vi.mock("@pluralscape/db/pg", () => ({
  webhookConfigs: { systemId: "system_id", enabled: "enabled", archived: "archived" },
  webhookDeliveries: { status: "status", nextRetryAt: "next_retry_at" },
}));

vi.mock("@pluralscape/types", async () => {
  const actual = await vi.importActual("@pluralscape/types");
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("wd_test-delivery-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    or: vi.fn((...args: unknown[]) => args),
    isNull: vi.fn((a: unknown) => ["isNull", a]),
    lte: vi.fn((a: unknown, b: unknown) => ["lte", a, b]),
  };
});

// ── Imports after mocks ──────────────────────────────────────────

const { clearWebhookConfigCache, dispatchWebhookEvent, invalidateWebhookConfigCache } =
  await import("../../services/webhook-dispatcher.js");

// ── Tests ────────────────────────────────────────────────────────

describe("dispatchWebhookEvent", () => {
  const systemId = "sys_test-system-id" as SystemId;
  const eventType = "member.created" as const;
  const payload = { memberId: "mem_test" as MemberId };

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire chained mocks after clearAllMocks
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    });
    mockDb.insert.mockReturnValue({
      values: mockInsertValues,
    });
    mockRawDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    });
    mockRawDb.insert.mockReturnValue({
      values: mockInsertValues,
    });
    mockRawDb.transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearWebhookConfigCache();
  });

  it("returns empty array when no configs match", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    expect(result).toEqual([]);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("creates deliveries for matching configs", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "wh_config-1", eventTypes: ["member.created", "member.updated"] },
      { id: "wh_config-2", eventTypes: ["fronting.started"] },
    ]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    const result = await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    // Only config-1 matches member.created
    expect(result).toHaveLength(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("creates multiple deliveries for multiple matching configs", async () => {
    mockWhere.mockResolvedValueOnce([
      { id: "wh_config-1", eventTypes: ["member.created"] },
      { id: "wh_config-2", eventTypes: ["member.created", "group.created"] },
    ]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    const result = await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    expect(result).toHaveLength(2);
  });

  it("stores payload on delivery records", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    const insertedValues = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(insertedValues[0]).toHaveProperty("payloadData", { ...payload, systemId });
  });

  it("uses cached configs on second dispatch for same system", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);
    mockInsertValues.mockResolvedValue(undefined);

    // Use raw db (non-transaction) so cache is populated
    await dispatchWebhookEvent(mockRawDb as never, systemId, eventType, payload);
    await dispatchWebhookEvent(mockRawDb as never, systemId, eventType, payload);

    // DB select should only be called once (first call populates cache)
    expect(mockDb.select).toHaveBeenCalledTimes(1);
    // But insert should be called twice (one delivery per dispatch)
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("skips cache population when called within a transaction", async () => {
    mockWhere
      .mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }])
      .mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);
    mockInsertValues.mockResolvedValue(undefined);

    // Use transaction db — cache should NOT be populated
    await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);
    await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    // DB select called twice (no caching in transaction mode)
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it("re-queries DB after cache invalidation", async () => {
    mockWhere
      .mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }])
      .mockResolvedValueOnce([]);
    mockInsertValues.mockResolvedValue(undefined);

    await dispatchWebhookEvent(mockRawDb as never, systemId, eventType, payload);
    invalidateWebhookConfigCache(systemId);
    await dispatchWebhookEvent(mockRawDb as never, systemId, eventType, payload);

    // DB select called twice: first miss, then after invalidation
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it("does not share cache between systems", async () => {
    const otherSystemId = "sys_other" as SystemId;
    mockWhere
      .mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }])
      .mockResolvedValueOnce([]);
    mockInsertValues.mockResolvedValue(undefined);

    await dispatchWebhookEvent(mockRawDb as never, systemId, eventType, payload);
    await dispatchWebhookEvent(mockRawDb as never, otherSystemId, eventType, payload);

    // Each system triggers its own DB query
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it("re-queries DB after cache TTL expires", async () => {
    vi.useFakeTimers();
    try {
      mockWhere
        .mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }])
        .mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);
      mockInsertValues.mockResolvedValue(undefined);

      await dispatchWebhookEvent(mockRawDb as never, systemId, eventType, payload);

      // Advance past the 60s TTL
      vi.advanceTimersByTime(60_001);

      await dispatchWebhookEvent(mockRawDb as never, systemId, eventType, payload);

      // DB select called twice: first miss, then after TTL expiry
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stores encryptedData when encryption key is configured", async () => {
    const fakeKey = new Uint8Array(32).fill(0xab);
    mockGetKey.mockReturnValueOnce(fakeKey);
    mockWhere.mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    const insertedValues = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(insertedValues[0]).toHaveProperty("encryptedData");
    expect(insertedValues[0]).not.toHaveProperty("payloadData");
    expect(mockEncrypt).toHaveBeenCalledTimes(1);
  });

  it("calls memzero on encryption key after dispatch", async () => {
    const fakeKey = new Uint8Array(32).fill(0xab);
    mockGetKey.mockReturnValueOnce(fakeKey);
    mockWhere.mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    expect(mockMemzero).toHaveBeenCalledWith(fakeKey);
  });
});
