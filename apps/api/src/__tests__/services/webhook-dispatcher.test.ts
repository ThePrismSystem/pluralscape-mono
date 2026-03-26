import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemberId, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

const mockInsertValues = vi.fn();
const mockWhere = vi.fn();

const mockTx = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: mockWhere,
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: mockInsertValues,
  }),
};

const mockDb = {
  transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

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

const { dispatchWebhookEvent } = await import("../../services/webhook-dispatcher.js");

// ── Tests ────────────────────────────────────────────────────────

describe("dispatchWebhookEvent", () => {
  const systemId = "sys_test-system-id" as SystemId;
  const eventType = "member.created" as const;
  const payload = { memberId: "mem_test" as MemberId };

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-wire transaction mock after clearAllMocks
    mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when no configs match", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const result = await dispatchWebhookEvent(mockDb as never, systemId, eventType, payload);

    expect(result).toEqual([]);
    expect(mockTx.insert).not.toHaveBeenCalled();
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
    expect(mockTx.insert).toHaveBeenCalledTimes(1);
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
});
