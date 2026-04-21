import { brandId } from "@pluralscape/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberId, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

const mockInsertValues = vi.fn();
const mockWhere = vi.fn();

const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: mockWhere,
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: mockInsertValues,
  }),
};

const mockGetKey = vi.fn().mockReturnValue(new Uint8Array(32).fill(0xab));
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

const { clearWebhookConfigCache, dispatchWebhookEvent } =
  await import("../../services/webhook-dispatcher.js");

// ── Tests ────────────────────────────────────────────────────────

describe("dispatchWebhookEvent", () => {
  const systemId = brandId<SystemId>("sys_test-system-id");
  const eventType = "member.created" as const;
  const payload = { memberId: brandId<MemberId>("mem_test") };

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

  it("stores encrypted payload on delivery records", async () => {
    mockWhere.mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    const insertedValues = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(insertedValues[0]).toHaveProperty("encryptedData");

    expect(mockEncrypt).toHaveBeenCalledTimes(1);
  });

  it("throws when WEBHOOK_PAYLOAD_ENCRYPTION_KEY is not configured", async () => {
    mockGetKey.mockImplementationOnce(() => {
      throw new Error("WEBHOOK_PAYLOAD_ENCRYPTION_KEY is required");
    });
    mockWhere.mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);

    await expect(
      dispatchWebhookEvent(mockDb as never, systemId, eventType, payload),
    ).rejects.toThrow("WEBHOOK_PAYLOAD_ENCRYPTION_KEY is required");
  });

  it("encrypts payload with the configured encryption key", async () => {
    const fakeKey = new Uint8Array(32).fill(0xab);
    mockGetKey.mockReturnValueOnce(fakeKey);
    mockWhere.mockResolvedValueOnce([{ id: "wh_config-1", eventTypes: ["member.created"] }]);
    mockInsertValues.mockResolvedValueOnce(undefined);

    await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    const insertedValues = mockInsertValues.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(insertedValues[0]).toHaveProperty("encryptedData");

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
