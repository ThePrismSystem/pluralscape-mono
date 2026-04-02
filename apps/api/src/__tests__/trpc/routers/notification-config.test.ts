import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOCK_SYSTEM_ID, makeCallerFactory, type SystemId } from "../test-helpers.js";

import type { NotificationConfigId, NotificationEventType, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/notification-config.service.js", () => ({
  getOrCreateNotificationConfig: vi.fn(),
  updateNotificationConfig: vi.fn(),
  listNotificationConfigs: vi.fn(),
}));

const { getOrCreateNotificationConfig, updateNotificationConfig, listNotificationConfigs } =
  await import("../../../services/notification-config.service.js");

const { notificationConfigRouter } = await import("../../../trpc/routers/notification-config.js");

const createCaller = makeCallerFactory({ notificationConfig: notificationConfigRouter });

const CONFIG_ID = "nc_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as NotificationConfigId;
const EVENT_TYPE: NotificationEventType = "check-in-due";

const MOCK_CONFIG_RESULT = {
  id: CONFIG_ID,
  systemId: MOCK_SYSTEM_ID,
  eventType: EVENT_TYPE,
  enabled: true,
  pushEnabled: true,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("notificationConfig router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── get ─────────────────────────────────────────────────────────────

  describe("notificationConfig.get", () => {
    it("calls getOrCreateNotificationConfig with correct systemId and eventType", async () => {
      vi.mocked(getOrCreateNotificationConfig).mockResolvedValue(MOCK_CONFIG_RESULT);
      const caller = createCaller();
      const result = await caller.notificationConfig.get({
        systemId: MOCK_SYSTEM_ID,
        eventType: EVENT_TYPE,
      });

      expect(vi.mocked(getOrCreateNotificationConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(getOrCreateNotificationConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getOrCreateNotificationConfig).mock.calls[0]?.[2]).toBe(EVENT_TYPE);
      expect(result).toEqual(MOCK_CONFIG_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.notificationConfig.get({ systemId: MOCK_SYSTEM_ID, eventType: EVENT_TYPE }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.notificationConfig.get({ systemId: foreignSystemId, eventType: EVENT_TYPE }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("rejects invalid eventType", async () => {
      const caller = createCaller();
      await expect(
        caller.notificationConfig.get({
          systemId: MOCK_SYSTEM_ID,
          eventType: "not-a-valid-event-type" as NotificationEventType,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── update ───────────────────────────────────────────────────────────

  describe("notificationConfig.update", () => {
    it("calls updateNotificationConfig with correct args and returns result", async () => {
      vi.mocked(updateNotificationConfig).mockResolvedValue({
        ...MOCK_CONFIG_RESULT,
        enabled: false,
      });
      const caller = createCaller();
      const result = await caller.notificationConfig.update({
        systemId: MOCK_SYSTEM_ID,
        eventType: EVENT_TYPE,
        enabled: false,
      });

      expect(vi.mocked(updateNotificationConfig)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateNotificationConfig).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateNotificationConfig).mock.calls[0]?.[2]).toBe(EVENT_TYPE);
      expect(result.enabled).toBe(false);
    });

    it("passes pushEnabled flag to service", async () => {
      vi.mocked(updateNotificationConfig).mockResolvedValue({
        ...MOCK_CONFIG_RESULT,
        pushEnabled: false,
      });
      const caller = createCaller();
      await caller.notificationConfig.update({
        systemId: MOCK_SYSTEM_ID,
        eventType: EVENT_TYPE,
        pushEnabled: false,
      });

      const params = vi.mocked(updateNotificationConfig).mock.calls[0]?.[3];
      expect(params?.pushEnabled).toBe(false);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.notificationConfig.update({
          systemId: MOCK_SYSTEM_ID,
          eventType: EVENT_TYPE,
          enabled: true,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("notificationConfig.list", () => {
    it("calls listNotificationConfigs with correct systemId and returns result", async () => {
      const mockResult = [MOCK_CONFIG_RESULT];
      vi.mocked(listNotificationConfigs).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.notificationConfig.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listNotificationConfigs)).toHaveBeenCalledOnce();
      expect(vi.mocked(listNotificationConfigs).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.notificationConfig.list({ systemId: MOCK_SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(listNotificationConfigs).mockResolvedValue([]);
    const caller = createCaller();
    await caller.notificationConfig.list({ systemId: MOCK_SYSTEM_ID });
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalled();
    const callKey = vi.mocked(checkRateLimit).mock.calls[0]?.[0] as string;
    expect(callKey).toContain("readDefault");
  });
});
