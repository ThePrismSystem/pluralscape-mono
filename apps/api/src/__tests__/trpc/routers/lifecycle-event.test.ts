import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";

import type { AuditWriter } from "../../../lib/audit-writer.js";
import type { AuthContext } from "../../../lib/auth-context.js";
import type { TRPCContext } from "../../../trpc/context.js";
import type {
  AccountId,
  LifecycleEventId,
  SessionId,
  SystemId,
  UnixMillis,
} from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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

const SYSTEM_ID = "sys_550e8400-e29b-41d4-a716-446655440000" as SystemId;
const EVENT_ID = "evt_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as LifecycleEventId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JsaWZlY3ljbGU=";

const MOCK_AUTH: AuthContext = {
  accountId: "acct_test001" as AccountId,
  systemId: SYSTEM_ID,
  sessionId: "sess_test001" as SessionId,
  accountType: "system",
  ownedSystemIds: new Set([SYSTEM_ID]),
  auditLogIpTracking: false,
};

const noopAuditWriter: AuditWriter = () => Promise.resolve();

function makeContext(auth: AuthContext | null): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    auth,
    createAudit: () => noopAuditWriter,
    requestMeta: { ipAddress: null, userAgent: null },
  };
}

function makeCaller(auth: AuthContext | null = MOCK_AUTH) {
  const appRouter = router({ lifecycleEvent: lifecycleEventRouter });
  const createCaller = createCallerFactory(appRouter);
  return createCaller(makeContext(auth));
}

const MOCK_EVENT_RESULT = {
  id: EVENT_ID,
  systemId: SYSTEM_ID,
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
      const caller = makeCaller();
      const result = await caller.lifecycleEvent.create({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        eventType: "discovery",
        occurredAt: 1_700_000_000_000,
      });

      expect(vi.mocked(createLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(createLifecycleEvent).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_EVENT_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = makeCaller(null);
      await expect(
        caller.lifecycleEvent.create({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          eventType: "discovery",
          occurredAt: 1_700_000_000_000,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = makeCaller();
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
      const caller = makeCaller();
      const result = await caller.lifecycleEvent.get({ systemId: SYSTEM_ID, eventId: EVENT_ID });

      expect(vi.mocked(getLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(getLifecycleEvent).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
      expect(result).toEqual(MOCK_EVENT_RESULT);
    });

    it("rejects invalid eventId format", async () => {
      const caller = makeCaller();
      await expect(
        caller.lifecycleEvent.get({
          systemId: SYSTEM_ID,
          eventId: "not-an-event-id" as LifecycleEventId,
        }),
      ).rejects.toThrow();
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getLifecycleEvent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.lifecycleEvent.get({ systemId: SYSTEM_ID, eventId: EVENT_ID }),
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
      const caller = makeCaller();
      const result = await caller.lifecycleEvent.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listLifecycleEvents)).toHaveBeenCalledOnce();
      expect(vi.mocked(listLifecycleEvents).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, eventType, and includeArchived", async () => {
      vi.mocked(listLifecycleEvents).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = makeCaller();
      await caller.lifecycleEvent.list({
        systemId: SYSTEM_ID,
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
      const caller = makeCaller();
      const result = await caller.lifecycleEvent.update({
        systemId: SYSTEM_ID,
        eventId: EVENT_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateLifecycleEvent).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(updateLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
      expect(result).toEqual(MOCK_EVENT_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateLifecycleEvent).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version conflict"),
      );
      const caller = makeCaller();
      await expect(
        caller.lifecycleEvent.update({
          systemId: SYSTEM_ID,
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
      const caller = makeCaller();
      const result = await caller.lifecycleEvent.archive({
        systemId: SYSTEM_ID,
        eventId: EVENT_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveLifecycleEvent).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveLifecycleEvent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.lifecycleEvent.archive({ systemId: SYSTEM_ID, eventId: EVENT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ──────────────────────────────────────────────────────────

  describe("lifecycleEvent.restore", () => {
    it("calls restoreLifecycleEvent and returns result", async () => {
      vi.mocked(restoreLifecycleEvent).mockResolvedValue(MOCK_EVENT_RESULT);
      const caller = makeCaller();
      const result = await caller.lifecycleEvent.restore({
        systemId: SYSTEM_ID,
        eventId: EVENT_ID,
      });

      expect(vi.mocked(restoreLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreLifecycleEvent).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
      expect(result).toEqual(MOCK_EVENT_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreLifecycleEvent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.lifecycleEvent.restore({ systemId: SYSTEM_ID, eventId: EVENT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ───────────────────────────────────────────────────────────

  describe("lifecycleEvent.delete", () => {
    it("calls deleteLifecycleEvent and returns success", async () => {
      vi.mocked(deleteLifecycleEvent).mockResolvedValue(undefined);
      const caller = makeCaller();
      const result = await caller.lifecycleEvent.delete({ systemId: SYSTEM_ID, eventId: EVENT_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteLifecycleEvent)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteLifecycleEvent).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteLifecycleEvent).mock.calls[0]?.[2]).toBe(EVENT_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteLifecycleEvent).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Lifecycle event not found"),
      );
      const caller = makeCaller();
      await expect(
        caller.lifecycleEvent.delete({ systemId: SYSTEM_ID, eventId: EVENT_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
});
