import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_SYSTEM_ID, makeCallerFactory, assertProcedureRateLimited } from "../test-helpers.js";

import type { UnixMillis, WebhookId } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

// Keep the real `toServerSecret` — it's a pure brand-narrowing helper with no
// external deps, and importing it from the mocked module avoids duplicating
// the `as ServerSecret` cast in every test file.
vi.mock("../../../services/webhook-config.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../services/webhook-config.service.js")>();
  return {
    archiveWebhookConfig: vi.fn(),
    createWebhookConfig: vi.fn(),
    deleteWebhookConfig: vi.fn(),
    getWebhookConfig: vi.fn(),
    listWebhookConfigs: vi.fn(),
    restoreWebhookConfig: vi.fn(),
    rotateWebhookSecret: vi.fn(),
    testWebhookConfig: vi.fn(),
    updateWebhookConfig: vi.fn(),
    toServerSecret: actual.toServerSecret,
  };
});

const {
  archiveWebhookConfig,
  createWebhookConfig,
  deleteWebhookConfig,
  getWebhookConfig,
  listWebhookConfigs,
  restoreWebhookConfig,
  rotateWebhookSecret,
  testWebhookConfig,
  toServerSecret,
  updateWebhookConfig,
} = await import("../../../services/webhook-config.service.js");

const { webhookConfigRouter } = await import("../../../trpc/routers/webhook-config.js");

const createCaller = makeCallerFactory({ webhookConfig: webhookConfigRouter });

const WEBHOOK_ID = brandId<WebhookId>("wh_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

const MOCK_WEBHOOK = {
  id: WEBHOOK_ID,
  systemId: MOCK_SYSTEM_ID,
  url: "https://example.com/hook",
  eventTypes: ["fronting.started"] as const,
  enabled: true,
  archived: false as const,
  archivedAt: null,
  cryptoKeyId: null,
  version: 1,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

const VALID_CREATE_INPUT = {
  systemId: MOCK_SYSTEM_ID,
  url: "https://example.com/hook",
  eventTypes: ["fronting.started" as const],
  cryptoKeyId: undefined,
};

const EMPTY_LIST = {
  data: [],
  nextCursor: null,
  hasMore: false,
  totalCount: null,
};

describe("webhookConfig router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("webhookConfig.list", () => {
    it("calls listWebhookConfigs and returns result", async () => {
      vi.mocked(listWebhookConfigs).mockResolvedValue({
        ...EMPTY_LIST,
        data: [MOCK_WEBHOOK],
      });
      const caller = createCaller();
      const result = await caller.webhookConfig.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listWebhookConfigs)).toHaveBeenCalledOnce();
      expect(vi.mocked(listWebhookConfigs).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result.data).toHaveLength(1);
    });

    it("passes cursor, limit, and includeArchived to service", async () => {
      vi.mocked(listWebhookConfigs).mockResolvedValue(EMPTY_LIST);
      const caller = createCaller();
      await caller.webhookConfig.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "abc",
        limit: 10,
        includeArchived: true,
      });

      const opts = vi.mocked(listWebhookConfigs).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
    });

    it("converts null cursor to undefined", async () => {
      vi.mocked(listWebhookConfigs).mockResolvedValue(EMPTY_LIST);
      const caller = createCaller();
      await caller.webhookConfig.list({ systemId: MOCK_SYSTEM_ID, cursor: null });

      const opts = vi.mocked(listWebhookConfigs).mock.calls[0]?.[3];
      expect(opts?.cursor).toBeUndefined();
    });
  });

  // ── get ──────────────────────────────────────────────────────────────

  describe("webhookConfig.get", () => {
    it("calls getWebhookConfig with webhookId", async () => {
      vi.mocked(getWebhookConfig).mockResolvedValue(MOCK_WEBHOOK);
      const caller = createCaller();
      await caller.webhookConfig.get({ systemId: MOCK_SYSTEM_ID, webhookId: WEBHOOK_ID });

      expect(vi.mocked(getWebhookConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(getWebhookConfig).mock.calls[0]?.[2]).toBe(WEBHOOK_ID);
    });

    it("rejects invalid webhookId format", async () => {
      const caller = createCaller();
      await expect(
        caller.webhookConfig.get({
          systemId: MOCK_SYSTEM_ID,
          webhookId: brandId<WebhookId>("not-a-webhook"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── create ───────────────────────────────────────────────────────────

  describe("webhookConfig.create", () => {
    it("calls createWebhookConfig and returns result", async () => {
      vi.mocked(createWebhookConfig).mockResolvedValue({
        ...MOCK_WEBHOOK,
        secret: "whsec_test",
        secretBytes: toServerSecret(Buffer.from("whsec_test")),
      });
      const caller = createCaller();
      await caller.webhookConfig.create(VALID_CREATE_INPUT);

      expect(vi.mocked(createWebhookConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(createWebhookConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
    });

    it("rejects invalid URL", async () => {
      const caller = createCaller();
      await expect(
        caller.webhookConfig.create({ ...VALID_CREATE_INPUT, url: "not-a-url" }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("rejects empty eventTypes", async () => {
      const caller = createCaller();
      await expect(
        caller.webhookConfig.create({ ...VALID_CREATE_INPUT, eventTypes: [] }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── update ───────────────────────────────────────────────────────────

  describe("webhookConfig.update", () => {
    it("calls updateWebhookConfig with parsed body", async () => {
      vi.mocked(updateWebhookConfig).mockResolvedValue(MOCK_WEBHOOK);
      const caller = createCaller();
      await caller.webhookConfig.update({
        systemId: MOCK_SYSTEM_ID,
        webhookId: WEBHOOK_ID,
        url: "https://updated.example.com/hook",
        version: 2,
      });

      expect(vi.mocked(updateWebhookConfig)).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(updateWebhookConfig).mock.calls[0];
      expect(callArgs?.[2]).toBe(WEBHOOK_ID);
      expect(callArgs?.[3]).toMatchObject({
        url: "https://updated.example.com/hook",
        version: 2,
      });
    });
  });

  // ── delete ───────────────────────────────────────────────────────────

  describe("webhookConfig.delete", () => {
    it("calls deleteWebhookConfig and returns success", async () => {
      vi.mocked(deleteWebhookConfig).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.webhookConfig.delete({
        systemId: MOCK_SYSTEM_ID,
        webhookId: WEBHOOK_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteWebhookConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteWebhookConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteWebhookConfig).mock.calls[0]?.[2]).toBe(WEBHOOK_ID);
    });
  });

  // ── archive ──────────────────────────────────────────────────────────

  describe("webhookConfig.archive", () => {
    it("calls archiveWebhookConfig and returns success", async () => {
      vi.mocked(archiveWebhookConfig).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.webhookConfig.archive({
        systemId: MOCK_SYSTEM_ID,
        webhookId: WEBHOOK_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveWebhookConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveWebhookConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveWebhookConfig).mock.calls[0]?.[2]).toBe(WEBHOOK_ID);
    });
  });

  // ── restore ──────────────────────────────────────────────────────────

  describe("webhookConfig.restore", () => {
    it("calls restoreWebhookConfig and returns result", async () => {
      vi.mocked(restoreWebhookConfig).mockResolvedValue(MOCK_WEBHOOK);
      const caller = createCaller();
      await caller.webhookConfig.restore({
        systemId: MOCK_SYSTEM_ID,
        webhookId: WEBHOOK_ID,
      });

      expect(vi.mocked(restoreWebhookConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreWebhookConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreWebhookConfig).mock.calls[0]?.[2]).toBe(WEBHOOK_ID);
    });
  });

  // ── rotateSecret ─────────────────────────────────────────────────────

  describe("webhookConfig.rotateSecret", () => {
    it("calls rotateWebhookSecret with parsed body", async () => {
      vi.mocked(rotateWebhookSecret).mockResolvedValue({
        ...MOCK_WEBHOOK,
        secret: "whsec_rotated",
        secretBytes: toServerSecret(Buffer.from("whsec_rotated")),
      });
      const caller = createCaller();
      await caller.webhookConfig.rotateSecret({
        systemId: MOCK_SYSTEM_ID,
        webhookId: WEBHOOK_ID,
        version: 2,
      });

      expect(vi.mocked(rotateWebhookSecret)).toHaveBeenCalledOnce();
      const callArgs = vi.mocked(rotateWebhookSecret).mock.calls[0];
      expect(callArgs?.[3]).toMatchObject({ version: 2 });
    });
  });

  // ── test ─────────────────────────────────────────────────────────────

  describe("webhookConfig.test", () => {
    it("calls testWebhookConfig and returns result", async () => {
      vi.mocked(testWebhookConfig).mockResolvedValue({ delivered: true } as never);
      const caller = createCaller();
      await caller.webhookConfig.test({
        systemId: MOCK_SYSTEM_ID,
        webhookId: WEBHOOK_ID,
      });

      expect(vi.mocked(testWebhookConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(testWebhookConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(testWebhookConfig).mock.calls[0]?.[2]).toBe(WEBHOOK_ID);
    });
  });

  // ── auth ─────────────────────────────────────────────────────────────

  it("throws UNAUTHORIZED for unauthenticated callers", async () => {
    const caller = createCaller(null);
    await expect(caller.webhookConfig.list({ systemId: MOCK_SYSTEM_ID })).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  // ── rate limiting ────────────────────────────────────────────────────

  it("applies readDefault rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listWebhookConfigs).mockResolvedValue(EMPTY_LIST);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.webhookConfig.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies write rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createWebhookConfig).mockResolvedValue({
      ...MOCK_WEBHOOK,
      secret: "whsec_test",
      secretBytes: toServerSecret(Buffer.from("whsec_test")),
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.webhookConfig.create(VALID_CREATE_INPUT),
      "write",
    );
  });
});
