import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { LifecycleEventId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/lifecycle-event.service.js", () => ({
  createLifecycleEvent: vi.fn(),
  getLifecycleEvent: vi.fn(),
  listLifecycleEvents: vi.fn(),
  updateLifecycleEvent: vi.fn(),
  archiveLifecycleEvent: vi.fn(),
  restoreLifecycleEvent: vi.fn(),
  deleteLifecycleEvent: vi.fn(),
}));

const {
  createLifecycleEvent,
  getLifecycleEvent,
  listLifecycleEvents,
  updateLifecycleEvent,
  archiveLifecycleEvent,
  restoreLifecycleEvent,
  deleteLifecycleEvent,
} = await import("../../../services/lifecycle-event.service.js");

const { lifecycleEventRouter } = await import("../../../trpc/routers/lifecycle-event.js");

const createCaller = makeCallerFactory({ lifecycleEvent: lifecycleEventRouter });

const EVENT_ID = "evt_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as LifecycleEventId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JsaWZlY3ljbGU=";

const MOCK_EVENT_RESULT = {
  id: EVENT_ID,
  systemId: MOCK_SYSTEM_ID,
  eventType: "discovery" as const,
  occurredAt: 1_700_000_000_000 as UnixMillis,
  recordedAt: 1_700_000_000_000 as UnixMillis,
  encryptedData: "base64data==",
  plaintextMetadata: null,
  version: 1,
  archived: false,
  archivedAt: null,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("lifecycleEvent router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ───────────────────────────────────────────────────────────

  describe("lifecycleEvent.create", () => {
    it("calls createLifecycleEvent with correct systemId and returns result", async () => {
      vi.mocked(createLifecycleEvent).mockResolvedValue(MOCK_EVENT_RESULT);
      const caller = createCaller();
      const result = await caller.lifecycleEvent.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        eventType: "discovery",
        occurredAt: 1_700_000_000_000,
      });

      expect(vi.mocked(createLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(createLifecycleEvent).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_EVENT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.lifecycleEvent.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          eventType: "discovery",
          occurredAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.lifecycleEvent.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          eventType: "discovery",
          occurredAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ──────────────────────────────────────────────────────────────

  describe("lifecycleEvent.get", () => {
    it("calls getLifecycleEvent with correct systemId and eventId", async () => {
      vi.mocked(getLifecycleEvent).mockResolvedValue(MOCK_EVENT_RESULT);
      const caller = createCaller();
      const result = await caller.lifecycleEvent.get({
        systemId: MOCK_SYSTEM_ID,
        eventId: EVENT_ID,
      });

      expect(vi.mocked(getLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(getLifecycleEvent).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
      expect(result).toEqual(MOCK_EVENT_RESULT);
    });

    it("rejects invalid eventId format", async () => {
      const caller = createCaller();
      await expect(
        caller.lifecycleEvent.get({
          systemId: MOCK_SYSTEM_ID,
          eventId: "not-an-event-id" as LifecycleEventId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getLifecycleEvent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
      );
      const caller = createCaller();
      await expect(
        caller.lifecycleEvent.get({ systemId: MOCK_SYSTEM_ID, eventId: EVENT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ─────────────────────────────────────────────────────────────

  describe("lifecycleEvent.list", () => {
    it("calls listLifecycleEvents and returns result", async () => {
      const mockResult = {
        data: [MOCK_EVENT_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listLifecycleEvents).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.lifecycleEvent.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listLifecycleEvents)).toHaveBeenCalledOnce();
      expect(vi.mocked(listLifecycleEvents).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, eventType, and includeArchived", async () => {
      vi.mocked(listLifecycleEvents).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.lifecycleEvent.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cursor_abc",
        limit: 10,
        eventType: "discovery",
        includeArchived: true,
      });

      const call = vi.mocked(listLifecycleEvents).mock.calls[0];
      expect(call?.[3]).toBe("cursor_abc");
      expect(call?.[4]).toBe(10);
      expect(call?.[5]).toBe("discovery");
      expect(call?.[6]).toBe(true);
    });
  });

  // ── update ───────────────────────────────────────────────────────────

  describe("lifecycleEvent.update", () => {
    it("calls updateLifecycleEvent with correct systemId and eventId", async () => {
      vi.mocked(updateLifecycleEvent).mockResolvedValue(MOCK_EVENT_RESULT);
      const caller = createCaller();
      const result = await caller.lifecycleEvent.update({
        systemId: MOCK_SYSTEM_ID,
        eventId: EVENT_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateLifecycleEvent).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
      expect(result).toEqual(MOCK_EVENT_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateLifecycleEvent).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version conflict"),
      );
      const caller = createCaller();
      await expect(
        caller.lifecycleEvent.update({
          systemId: MOCK_SYSTEM_ID,
          eventId: EVENT_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ──────────────────────────────────────────────────────────

  describe("lifecycleEvent.archive", () => {
    it("calls archiveLifecycleEvent and returns success", async () => {
      vi.mocked(archiveLifecycleEvent).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.lifecycleEvent.archive({
        systemId: MOCK_SYSTEM_ID,
        eventId: EVENT_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveLifecycleEvent).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveLifecycleEvent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
      );
      const caller = createCaller();
      await expect(
        caller.lifecycleEvent.archive({ systemId: MOCK_SYSTEM_ID, eventId: EVENT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ──────────────────────────────────────────────────────────

  describe("lifecycleEvent.restore", () => {
    it("calls restoreLifecycleEvent and returns result", async () => {
      vi.mocked(restoreLifecycleEvent).mockResolvedValue(MOCK_EVENT_RESULT);
      const caller = createCaller();
      const result = await caller.lifecycleEvent.restore({
        systemId: MOCK_SYSTEM_ID,
        eventId: EVENT_ID,
      });

      expect(vi.mocked(restoreLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreLifecycleEvent).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
      expect(result).toEqual(MOCK_EVENT_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreLifecycleEvent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
      );
      const caller = createCaller();
      await expect(
        caller.lifecycleEvent.restore({ systemId: MOCK_SYSTEM_ID, eventId: EVENT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ───────────────────────────────────────────────────────────

  describe("lifecycleEvent.delete", () => {
    it("calls deleteLifecycleEvent and returns success", async () => {
      vi.mocked(deleteLifecycleEvent).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.lifecycleEvent.delete({
        systemId: MOCK_SYSTEM_ID,
        eventId: EVENT_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteLifecycleEvent).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteLifecycleEvent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
      );
      const caller = createCaller();
      await expect(
        caller.lifecycleEvent.delete({ systemId: MOCK_SYSTEM_ID, eventId: EVENT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listLifecycleEvents).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.lifecycleEvent.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createLifecycleEvent).mockResolvedValue(MOCK_EVENT_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.lifecycleEvent.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          eventType: "discovery",
          occurredAt: 1_700_000_000_000,
        }),
      "write",
    );
  });
});
