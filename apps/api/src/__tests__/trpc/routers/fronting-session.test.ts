import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { SYSTEM_ID, makeCallerFactory } from "../test-helpers.js";

import type { FrontingSessionId, MemberId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../services/fronting-session.service.js", () => ({
  createFrontingSession: vi.fn(),
  getFrontingSession: vi.fn(),
  listFrontingSessions: vi.fn(),
  updateFrontingSession: vi.fn(),
  endFrontingSession: vi.fn(),
  archiveFrontingSession: vi.fn(),
  restoreFrontingSession: vi.fn(),
  deleteFrontingSession: vi.fn(),
  getActiveFronting: vi.fn(),
}));

const {
  createFrontingSession,
  getFrontingSession,
  listFrontingSessions,
  updateFrontingSession,
  endFrontingSession,
  archiveFrontingSession,
  restoreFrontingSession,
  deleteFrontingSession,
  getActiveFronting,
} = await import("../../../services/fronting-session.service.js");

const { frontingSessionRouter } = await import("../../../trpc/routers/fronting-session.js");

const createCaller = makeCallerFactory({ frontingSession: frontingSessionRouter });

const SESSION_ID = "fs_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as FrontingSessionId;
const MEMBER_ID = "mem_11111111-2222-3333-4444-555555555555" as MemberId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZW1iZXI=";
const START_TIME = 1_700_000_000_000 as UnixMillis;

const MOCK_SESSION_RESULT = {
  id: SESSION_ID,
  systemId: SYSTEM_ID,
  memberId: MEMBER_ID,
  customFrontId: null,
  structureEntityId: null,
  startTime: START_TIME,
  endTime: null,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: START_TIME,
  updatedAt: START_TIME,
};

describe("frontingSession router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("frontingSession.create", () => {
    it("calls createFrontingSession with correct systemId and returns result", async () => {
      vi.mocked(createFrontingSession).mockResolvedValue(MOCK_SESSION_RESULT);
      const caller = createCaller();
      const result = await caller.frontingSession.create({
        systemId: SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        startTime: START_TIME,
        memberId: MEMBER_ID,
        customFrontId: undefined,
        structureEntityId: undefined,
      });

      expect(vi.mocked(createFrontingSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(createFrontingSession).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(MOCK_SESSION_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.frontingSession.create({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          startTime: START_TIME,
          memberId: MEMBER_ID,
          customFrontId: undefined,
          structureEntityId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("rejects input missing both memberId and customFrontId (no subject)", async () => {
      const caller = createCaller();
      const createWithUnknownInput = caller.frontingSession.create as (
        input: Record<string, unknown>,
      ) => Promise<unknown>;
      await expect(
        createWithUnknownInput({
          systemId: SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          startTime: START_TIME,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("frontingSession.get", () => {
    it("calls getFrontingSession with correct systemId and sessionId", async () => {
      vi.mocked(getFrontingSession).mockResolvedValue(MOCK_SESSION_RESULT);
      const caller = createCaller();
      const result = await caller.frontingSession.get({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
      });

      expect(vi.mocked(getFrontingSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(getFrontingSession).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(getFrontingSession).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(result).toEqual(MOCK_SESSION_RESULT);
    });

    it("rejects invalid sessionId format", async () => {
      const caller = createCaller();
      await expect(
        caller.frontingSession.get({
          systemId: SYSTEM_ID,
          sessionId: "not-a-session-id" as FrontingSessionId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getFrontingSession).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Fronting session not found"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingSession.get({ systemId: SYSTEM_ID, sessionId: SESSION_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("frontingSession.list", () => {
    it("calls listFrontingSessions and returns result", async () => {
      const mockResult = {
        data: [MOCK_SESSION_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listFrontingSessions).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.frontingSession.list({ systemId: SYSTEM_ID });

      expect(vi.mocked(listFrontingSessions)).toHaveBeenCalledOnce();
      expect(vi.mocked(listFrontingSessions).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes filters as opts", async () => {
      vi.mocked(listFrontingSessions).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.frontingSession.list({
        systemId: SYSTEM_ID,
        activeOnly: true,
        includeArchived: false,
        startFrom: 1_000_000,
        startUntil: 2_000_000,
        limit: 20,
      });

      const opts = vi.mocked(listFrontingSessions).mock.calls[0]?.[3];
      expect(opts?.activeOnly).toBe(true);
      expect(opts?.startFrom).toBe(1_000_000);
      expect(opts?.startUntil).toBe(2_000_000);
      expect(opts?.limit).toBe(20);
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("frontingSession.update", () => {
    it("calls updateFrontingSession with correct args and returns result", async () => {
      vi.mocked(updateFrontingSession).mockResolvedValue(MOCK_SESSION_RESULT);
      const caller = createCaller();
      const result = await caller.frontingSession.update({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateFrontingSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateFrontingSession).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(updateFrontingSession).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(result).toEqual(MOCK_SESSION_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT on version mismatch", async () => {
      vi.mocked(updateFrontingSession).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingSession.update({
          systemId: SYSTEM_ID,
          sessionId: SESSION_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── end ───────────────────────────────────────────────────────────

  describe("frontingSession.end", () => {
    it("calls endFrontingSession with correct args and returns result", async () => {
      const endedSession = {
        ...MOCK_SESSION_RESULT,
        endTime: (START_TIME + 3_600_000) as UnixMillis,
      };
      vi.mocked(endFrontingSession).mockResolvedValue(endedSession);
      const caller = createCaller();
      const result = await caller.frontingSession.end({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
        endTime: START_TIME + 3_600_000,
        version: 1,
      });

      expect(vi.mocked(endFrontingSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(endFrontingSession).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(endFrontingSession).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(result).toEqual(endedSession);
    });

    it("surfaces ApiHttpError(400) ALREADY_ENDED as BAD_REQUEST", async () => {
      vi.mocked(endFrontingSession).mockRejectedValue(
        new ApiHttpError(400, "ALREADY_ENDED", "Session already ended"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingSession.end({
          systemId: SYSTEM_ID,
          sessionId: SESSION_ID,
          endTime: START_TIME + 3_600_000,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("frontingSession.archive", () => {
    it("calls archiveFrontingSession and returns success", async () => {
      vi.mocked(archiveFrontingSession).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.frontingSession.archive({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveFrontingSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveFrontingSession).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(archiveFrontingSession).mock.calls[0]?.[2]).toBe(SESSION_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveFrontingSession).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Fronting session not found"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingSession.archive({ systemId: SYSTEM_ID, sessionId: SESSION_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("frontingSession.restore", () => {
    it("calls restoreFrontingSession and returns the result", async () => {
      vi.mocked(restoreFrontingSession).mockResolvedValue(MOCK_SESSION_RESULT);
      const caller = createCaller();
      const result = await caller.frontingSession.restore({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
      });

      expect(vi.mocked(restoreFrontingSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreFrontingSession).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(restoreFrontingSession).mock.calls[0]?.[2]).toBe(SESSION_ID);
      expect(result).toEqual(MOCK_SESSION_RESULT);
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("frontingSession.delete", () => {
    it("calls deleteFrontingSession with correct args and returns success", async () => {
      vi.mocked(deleteFrontingSession).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.frontingSession.delete({
        systemId: SYSTEM_ID,
        sessionId: SESSION_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteFrontingSession)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteFrontingSession).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(vi.mocked(deleteFrontingSession).mock.calls[0]?.[2]).toBe(SESSION_ID);
    });

    it("surfaces ApiHttpError(409) HAS_DEPENDENTS as CONFLICT", async () => {
      vi.mocked(deleteFrontingSession).mockRejectedValue(
        new ApiHttpError(409, "HAS_DEPENDENTS", "Session has comments"),
      );
      const caller = createCaller();
      await expect(
        caller.frontingSession.delete({ systemId: SYSTEM_ID, sessionId: SESSION_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── getActive ─────────────────────────────────────────────────────

  describe("frontingSession.getActive", () => {
    it("calls getActiveFronting and returns result", async () => {
      const mockActive = {
        sessions: [MOCK_SESSION_RESULT],
        isCofronting: false,
        entityMemberMap: {},
      };
      vi.mocked(getActiveFronting).mockResolvedValue(mockActive);
      const caller = createCaller();
      const result = await caller.frontingSession.getActive({ systemId: SYSTEM_ID });

      expect(vi.mocked(getActiveFronting)).toHaveBeenCalledOnce();
      expect(vi.mocked(getActiveFronting).mock.calls[0]?.[1]).toBe(SYSTEM_ID);
      expect(result).toEqual(mockActive);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(caller.frontingSession.getActive({ systemId: SYSTEM_ID })).rejects.toThrow(
        expect.objectContaining({ code: "UNAUTHORIZED" }),
      );
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(listFrontingSessions).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await caller.frontingSession.list({ systemId: SYSTEM_ID });
    expect(vi.mocked(checkRateLimit)).toHaveBeenCalled();
    const callKey = vi.mocked(checkRateLimit).mock.calls[0]?.[0] as string;
    expect(callKey).toContain("readDefault");
  });
});
