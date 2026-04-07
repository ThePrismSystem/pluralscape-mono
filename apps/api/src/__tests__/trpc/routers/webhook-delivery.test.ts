import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_SYSTEM_ID, makeCallerFactory, assertProcedureRateLimited } from "../test-helpers.js";

import type { UnixMillis, WebhookDeliveryId, WebhookId } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/webhook-delivery.service.js", () => ({
  deleteWebhookDelivery: vi.fn(),
  getWebhookDelivery: vi.fn(),
  listWebhookDeliveries: vi.fn(),
}));

const { deleteWebhookDelivery, getWebhookDelivery, listWebhookDeliveries } =
  await import("../../../services/webhook-delivery.service.js");

const { webhookDeliveryRouter } = await import("../../../trpc/routers/webhook-delivery.js");

const createCaller = makeCallerFactory({ webhookDelivery: webhookDeliveryRouter });

const DELIVERY_ID = "wd_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as WebhookDeliveryId;
const WEBHOOK_ID = "wh_bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee" as WebhookId;

const MOCK_DELIVERY = {
  id: DELIVERY_ID,
  webhookId: WEBHOOK_ID,
  systemId: MOCK_SYSTEM_ID,
  eventType: "fronting.started" as const,
  status: "success" as const,
  httpStatus: 200,
  attemptCount: 1,
  lastAttemptAt: 1_700_000_000_000 as UnixMillis,
  nextRetryAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
};

const EMPTY_LIST = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("webhookDelivery router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("webhookDelivery.list", () => {
    it("calls listWebhookDeliveries and returns result", async () => {
      vi.mocked(listWebhookDeliveries).mockResolvedValue({
        ...EMPTY_LIST,
        data: [MOCK_DELIVERY],
      });
      const caller = createCaller();
      const result = await caller.webhookDelivery.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listWebhookDeliveries)).toHaveBeenCalledOnce();
      expect(vi.mocked(listWebhookDeliveries).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result.data).toHaveLength(1);
    });

    it("passes filters and pagination opts to service", async () => {
      vi.mocked(listWebhookDeliveries).mockResolvedValue(EMPTY_LIST);
      const caller = createCaller();
      await caller.webhookDelivery.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "abc",
        limit: 20,
        webhookId: WEBHOOK_ID,
        status: "failed",
        eventType: "fronting.started",
      });

      const opts = vi.mocked(listWebhookDeliveries).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("abc");
      expect(opts?.limit).toBe(20);
      expect(opts?.webhookId).toBe(WEBHOOK_ID);
      expect(opts?.status).toBe("failed");
      expect(opts?.eventType).toBe("fronting.started");
    });

    it("converts null cursor to undefined", async () => {
      vi.mocked(listWebhookDeliveries).mockResolvedValue(EMPTY_LIST);
      const caller = createCaller();
      await caller.webhookDelivery.list({ systemId: MOCK_SYSTEM_ID, cursor: null });

      const opts = vi.mocked(listWebhookDeliveries).mock.calls[0]?.[3];
      expect(opts?.cursor).toBeUndefined();
    });
  });

  // ── get ──────────────────────────────────────────────────────────────

  describe("webhookDelivery.get", () => {
    it("calls getWebhookDelivery with deliveryId", async () => {
      vi.mocked(getWebhookDelivery).mockResolvedValue(MOCK_DELIVERY);
      const caller = createCaller();
      await caller.webhookDelivery.get({ systemId: MOCK_SYSTEM_ID, deliveryId: DELIVERY_ID });

      expect(vi.mocked(getWebhookDelivery)).toHaveBeenCalledOnce();
      expect(vi.mocked(getWebhookDelivery).mock.calls[0]?.[2]).toBe(DELIVERY_ID);
    });

    it("rejects invalid deliveryId format", async () => {
      const caller = createCaller();
      await expect(
        caller.webhookDelivery.get({
          systemId: MOCK_SYSTEM_ID,
          deliveryId: "not-a-delivery" as WebhookDeliveryId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── delete ───────────────────────────────────────────────────────────

  describe("webhookDelivery.delete", () => {
    it("calls deleteWebhookDelivery and returns success", async () => {
      vi.mocked(deleteWebhookDelivery).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.webhookDelivery.delete({
        systemId: MOCK_SYSTEM_ID,
        deliveryId: DELIVERY_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteWebhookDelivery)).toHaveBeenCalledOnce();
    });
  });

  // ── auth ─────────────────────────────────────────────────────────────

  it("throws UNAUTHORIZED for unauthenticated callers", async () => {
    const caller = createCaller(null);
    await expect(caller.webhookDelivery.list({ systemId: MOCK_SYSTEM_ID })).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  // ── rate limiting ────────────────────────────────────────────────────

  it("applies readDefault rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listWebhookDeliveries).mockResolvedValue(EMPTY_LIST);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.webhookDelivery.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies write rate limiting to delete", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(deleteWebhookDelivery).mockResolvedValue(undefined);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.webhookDelivery.delete({ systemId: MOCK_SYSTEM_ID, deliveryId: DELIVERY_ID }),
      "write",
    );
  });
});
