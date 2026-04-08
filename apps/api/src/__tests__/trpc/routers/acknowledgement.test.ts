import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { AcknowledgementId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../lib/entity-pubsub.js", () => ({
  publishEntityChange: vi.fn().mockResolvedValue(undefined),
  subscribeToEntityChanges: vi.fn().mockResolvedValue(() => undefined),
}));

vi.mock("../../../services/acknowledgement.service.js", () => ({
  createAcknowledgement: vi.fn(),
  getAcknowledgement: vi.fn(),
  listAcknowledgements: vi.fn(),
  confirmAcknowledgement: vi.fn(),
  archiveAcknowledgement: vi.fn(),
  restoreAcknowledgement: vi.fn(),
  deleteAcknowledgement: vi.fn(),
}));

const {
  createAcknowledgement,
  getAcknowledgement,
  listAcknowledgements,
  confirmAcknowledgement,
  archiveAcknowledgement,
  restoreAcknowledgement,
  deleteAcknowledgement,
} = await import("../../../services/acknowledgement.service.js");

const { acknowledgementRouter } = await import("../../../trpc/routers/acknowledgement.js");

const createCaller = makeCallerFactory({ acknowledgement: acknowledgementRouter });

const ACK_ID = "ack_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" as AcknowledgementId;
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JhY2s=";

const MOCK_ACK_RESULT = {
  id: ACK_ID,
  systemId: MOCK_SYSTEM_ID,
  createdByMemberId: null,
  confirmed: false,
  encryptedData: "base64data==",
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("acknowledgement router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("acknowledgement.create", () => {
    it("calls createAcknowledgement with correct systemId and returns result", async () => {
      vi.mocked(createAcknowledgement).mockResolvedValue(MOCK_ACK_RESULT);
      const caller = createCaller();
      const result = await caller.acknowledgement.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        createdByMemberId: undefined,
      });

      expect(vi.mocked(createAcknowledgement)).toHaveBeenCalledOnce();
      expect(vi.mocked(createAcknowledgement).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_ACK_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.acknowledgement.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          createdByMemberId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = "sys_ffffffff-ffff-ffff-ffff-ffffffffffff" as SystemId;
      const caller = createCaller();
      await expect(
        caller.acknowledgement.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          createdByMemberId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("acknowledgement.get", () => {
    it("calls getAcknowledgement with correct systemId and ackId", async () => {
      vi.mocked(getAcknowledgement).mockResolvedValue(MOCK_ACK_RESULT);
      const caller = createCaller();
      const result = await caller.acknowledgement.get({ systemId: MOCK_SYSTEM_ID, ackId: ACK_ID });

      expect(vi.mocked(getAcknowledgement)).toHaveBeenCalledOnce();
      expect(vi.mocked(getAcknowledgement).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getAcknowledgement).mock.calls[0]?.[2]).toBe(ACK_ID);
      expect(result).toEqual(MOCK_ACK_RESULT);
    });

    it("rejects invalid ackId format", async () => {
      const caller = createCaller();
      await expect(
        caller.acknowledgement.get({
          systemId: MOCK_SYSTEM_ID,
          ackId: "invalid-id" as AcknowledgementId,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getAcknowledgement).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
      );
      const caller = createCaller();
      await expect(
        caller.acknowledgement.get({ systemId: MOCK_SYSTEM_ID, ackId: ACK_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("acknowledgement.list", () => {
    it("calls listAcknowledgements and returns result", async () => {
      const mockResult = {
        data: [MOCK_ACK_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listAcknowledgements).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.acknowledgement.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listAcknowledgements)).toHaveBeenCalledOnce();
      expect(vi.mocked(listAcknowledgements).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, includeArchived, and confirmed as opts", async () => {
      vi.mocked(listAcknowledgements).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.acknowledgement.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
        confirmed: false,
      });

      const opts = vi.mocked(listAcknowledgements).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
      expect(opts?.confirmed).toBe(false);
    });
  });

  // ── confirm ───────────────────────────────────────────────────────

  describe("acknowledgement.confirm", () => {
    it("calls confirmAcknowledgement with correct systemId and ackId", async () => {
      vi.mocked(confirmAcknowledgement).mockResolvedValue({
        ...MOCK_ACK_RESULT,
        confirmed: true,
      });
      const caller = createCaller();
      const result = await caller.acknowledgement.confirm({
        systemId: MOCK_SYSTEM_ID,
        ackId: ACK_ID,
      });

      expect(vi.mocked(confirmAcknowledgement)).toHaveBeenCalledOnce();
      expect(vi.mocked(confirmAcknowledgement).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(confirmAcknowledgement).mock.calls[0]?.[2]).toBe(ACK_ID);
      expect(result.confirmed).toBe(true);
    });

    it("passes optional encryptedData to confirmAcknowledgement", async () => {
      vi.mocked(confirmAcknowledgement).mockResolvedValue({
        ...MOCK_ACK_RESULT,
        confirmed: true,
      });
      const caller = createCaller();
      await caller.acknowledgement.confirm({
        systemId: MOCK_SYSTEM_ID,
        ackId: ACK_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(confirmAcknowledgement)).toHaveBeenCalledWith(
        expect.anything(),
        MOCK_SYSTEM_ID,
        ACK_ID,
        { encryptedData: VALID_ENCRYPTED_DATA },
        expect.anything(),
        expect.anything(),
      );
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(confirmAcknowledgement).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
      );
      const caller = createCaller();
      await expect(
        caller.acknowledgement.confirm({ systemId: MOCK_SYSTEM_ID, ackId: ACK_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("acknowledgement.archive", () => {
    it("calls archiveAcknowledgement and returns success", async () => {
      vi.mocked(archiveAcknowledgement).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.acknowledgement.archive({
        systemId: MOCK_SYSTEM_ID,
        ackId: ACK_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveAcknowledgement)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveAcknowledgement).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveAcknowledgement).mock.calls[0]?.[2]).toBe(ACK_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveAcknowledgement).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
      );
      const caller = createCaller();
      await expect(
        caller.acknowledgement.archive({ systemId: MOCK_SYSTEM_ID, ackId: ACK_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("acknowledgement.restore", () => {
    it("calls restoreAcknowledgement and returns the result", async () => {
      vi.mocked(restoreAcknowledgement).mockResolvedValue(MOCK_ACK_RESULT);
      const caller = createCaller();
      const result = await caller.acknowledgement.restore({
        systemId: MOCK_SYSTEM_ID,
        ackId: ACK_ID,
      });

      expect(vi.mocked(restoreAcknowledgement)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreAcknowledgement).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreAcknowledgement).mock.calls[0]?.[2]).toBe(ACK_ID);
      expect(result).toEqual(MOCK_ACK_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreAcknowledgement).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
      );
      const caller = createCaller();
      await expect(
        caller.acknowledgement.restore({ systemId: MOCK_SYSTEM_ID, ackId: ACK_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("acknowledgement.delete", () => {
    it("calls deleteAcknowledgement and returns success", async () => {
      vi.mocked(deleteAcknowledgement).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.acknowledgement.delete({
        systemId: MOCK_SYSTEM_ID,
        ackId: ACK_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteAcknowledgement)).toHaveBeenCalledOnce();
      expect(vi.mocked(deleteAcknowledgement).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deleteAcknowledgement).mock.calls[0]?.[2]).toBe(ACK_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteAcknowledgement).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Acknowledgement not found"),
      );
      const caller = createCaller();
      await expect(
        caller.acknowledgement.delete({ systemId: MOCK_SYSTEM_ID, ackId: ACK_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listAcknowledgements).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.acknowledgement.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createAcknowledgement).mockResolvedValue(MOCK_ACK_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.acknowledgement.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          createdByMemberId: undefined,
        }),
      "write",
    );
  });
});
