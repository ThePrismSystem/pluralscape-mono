import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import {
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { EncryptedBase64, PollId, PollVoteId, UnixMillis } from "@pluralscape/types";

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

vi.mock("../../../services/poll/create.js", () => ({ createPoll: vi.fn() }));
vi.mock("../../../services/poll/get.js", () => ({ getPoll: vi.fn() }));
vi.mock("../../../services/poll/list.js", () => ({ listPolls: vi.fn() }));
vi.mock("../../../services/poll/update.js", () => ({ updatePoll: vi.fn() }));
vi.mock("../../../services/poll/close.js", () => ({ closePoll: vi.fn() }));
vi.mock("../../../services/poll/archive.js", () => ({ archivePoll: vi.fn() }));
vi.mock("../../../services/poll/restore.js", () => ({ restorePoll: vi.fn() }));
vi.mock("../../../services/poll/delete.js", () => ({ deletePoll: vi.fn() }));

vi.mock("../../../services/poll-vote/cast.js", () => ({
  castVote: vi.fn(),
}));

vi.mock("../../../services/poll-vote/list.js", () => ({
  listVotes: vi.fn(),
}));

vi.mock("../../../services/poll-vote/update.js", () => ({
  updatePollVote: vi.fn(),
}));

vi.mock("../../../services/poll-vote/archive.js", () => ({
  deletePollVote: vi.fn(),
}));

vi.mock("../../../services/poll-vote/results.js", () => ({
  getPollResults: vi.fn(),
}));

const { createPoll } = await import("../../../services/poll/create.js");
const { getPoll } = await import("../../../services/poll/get.js");
const { listPolls } = await import("../../../services/poll/list.js");
const { updatePoll } = await import("../../../services/poll/update.js");
const { closePoll } = await import("../../../services/poll/close.js");
const { archivePoll } = await import("../../../services/poll/archive.js");
const { restorePoll } = await import("../../../services/poll/restore.js");
const { deletePoll } = await import("../../../services/poll/delete.js");

const { castVote } = await import("../../../services/poll-vote/cast.js");
const { listVotes } = await import("../../../services/poll-vote/list.js");
const { updatePollVote } = await import("../../../services/poll-vote/update.js");
const { deletePollVote } = await import("../../../services/poll-vote/archive.js");
const { getPollResults } = await import("../../../services/poll-vote/results.js");

const { pollRouter } = await import("../../../trpc/routers/poll.js");

const createCaller = makeCallerFactory({ poll: pollRouter });

const POLL_ID = brandId<PollId>("poll_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VOTE_ID = brandId<PollVoteId>("pv_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3Jwb2xs";

const MOCK_POLL_RESULT = {
  id: POLL_ID,
  systemId: MOCK_SYSTEM_ID,
  createdByMemberId: null,
  kind: "standard" as const,
  status: "open" as const,
  closedAt: null,
  endsAt: null,
  allowMultipleVotes: false,
  maxVotesPerMember: 1,
  allowAbstain: false,
  allowVeto: false,
  encryptedData: "base64data==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

const MOCK_VOTE_RESULT = {
  id: VOTE_ID,
  systemId: MOCK_SYSTEM_ID,
  pollId: POLL_ID,
  optionId: null,
  voter: null,
  isVeto: false,
  votedAt: 1_700_000_000_000 as UnixMillis,
  encryptedData: "base64data==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: 1_700_000_000_000 as UnixMillis,
  updatedAt: 1_700_000_000_000 as UnixMillis,
};

describe("poll router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("poll.create", () => {
    it("calls createPoll with correct systemId and returns result", async () => {
      vi.mocked(createPoll).mockResolvedValue(MOCK_POLL_RESULT);
      const caller = createCaller();
      const result = await caller.poll.create({
        systemId: MOCK_SYSTEM_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        kind: "standard",
        createdByMemberId: undefined,
        allowMultipleVotes: false,
        maxVotesPerMember: 1,
        allowAbstain: false,
        allowVeto: false,
      });

      expect(vi.mocked(createPoll)).toHaveBeenCalledOnce();
      expect(vi.mocked(createPoll).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(MOCK_POLL_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.poll.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          kind: "standard",
          createdByMemberId: undefined,
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
      const caller = createCaller();
      await expect(
        caller.poll.create({
          systemId: foreignSystemId,
          encryptedData: VALID_ENCRYPTED_DATA,
          kind: "standard",
          createdByMemberId: undefined,
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("poll.get", () => {
    it("calls getPoll with correct systemId and pollId", async () => {
      vi.mocked(getPoll).mockResolvedValue(MOCK_POLL_RESULT);
      const caller = createCaller();
      const result = await caller.poll.get({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID });

      expect(vi.mocked(getPoll)).toHaveBeenCalledOnce();
      expect(vi.mocked(getPoll).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getPoll).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(result).toEqual(MOCK_POLL_RESULT);
    });

    it("rejects invalid pollId format", async () => {
      const caller = createCaller();
      await expect(
        caller.poll.get({ systemId: MOCK_SYSTEM_ID, pollId: brandId<PollId>("invalid-id") }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getPoll).mockRejectedValue(new ApiHttpError(404, "NOT_FOUND", "Poll not found"));
      const caller = createCaller();
      await expect(caller.poll.get({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID })).rejects.toThrow(
        expect.objectContaining({ code: "NOT_FOUND" }),
      );
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("poll.list", () => {
    it("calls listPolls and returns result", async () => {
      const mockResult = {
        data: [MOCK_POLL_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listPolls).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.poll.list({ systemId: MOCK_SYSTEM_ID });

      expect(vi.mocked(listPolls)).toHaveBeenCalledOnce();
      expect(vi.mocked(listPolls).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, includeArchived, and status as opts", async () => {
      vi.mocked(listPolls).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.poll.list({
        systemId: MOCK_SYSTEM_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
        status: "open",
      });

      const opts = vi.mocked(listPolls).mock.calls[0]?.[3];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
      expect(opts?.status).toBe("open");
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("poll.update", () => {
    it("calls updatePoll with correct systemId and pollId", async () => {
      vi.mocked(updatePoll).mockResolvedValue(MOCK_POLL_RESULT);
      const caller = createCaller();
      const result = await caller.poll.update({
        systemId: MOCK_SYSTEM_ID,
        pollId: POLL_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updatePoll)).toHaveBeenCalledOnce();
      expect(vi.mocked(updatePoll).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updatePoll).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(result).toEqual(MOCK_POLL_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updatePoll).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.poll.update({
          systemId: MOCK_SYSTEM_ID,
          pollId: POLL_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── close ─────────────────────────────────────────────────────────

  describe("poll.close", () => {
    it("calls closePoll and returns the poll result", async () => {
      vi.mocked(closePoll).mockResolvedValue({ ...MOCK_POLL_RESULT, status: "closed" as const });
      const caller = createCaller();
      const result = await caller.poll.close({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID });

      expect(vi.mocked(closePoll)).toHaveBeenCalledOnce();
      expect(vi.mocked(closePoll).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(closePoll).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(result.status).toBe("closed");
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(closePoll).mockRejectedValue(new ApiHttpError(404, "NOT_FOUND", "Poll not found"));
      const caller = createCaller();
      await expect(
        caller.poll.close({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("poll.archive", () => {
    it("calls archivePoll and returns success", async () => {
      vi.mocked(archivePoll).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.poll.archive({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archivePoll)).toHaveBeenCalledOnce();
      expect(vi.mocked(archivePoll).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archivePoll).mock.calls[0]?.[2]).toBe(POLL_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archivePoll).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
      );
      const caller = createCaller();
      await expect(
        caller.poll.archive({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("poll.restore", () => {
    it("calls restorePoll and returns the poll result", async () => {
      vi.mocked(restorePoll).mockResolvedValue(MOCK_POLL_RESULT);
      const caller = createCaller();
      const result = await caller.poll.restore({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID });

      expect(vi.mocked(restorePoll)).toHaveBeenCalledOnce();
      expect(vi.mocked(restorePoll).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restorePoll).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(result).toEqual(MOCK_POLL_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restorePoll).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
      );
      const caller = createCaller();
      await expect(
        caller.poll.restore({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("poll.delete", () => {
    it("calls deletePoll and returns success", async () => {
      vi.mocked(deletePoll).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.poll.delete({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deletePoll)).toHaveBeenCalledOnce();
      expect(vi.mocked(deletePoll).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deletePoll).mock.calls[0]?.[2]).toBe(POLL_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deletePoll).mockRejectedValue(new ApiHttpError(404, "NOT_FOUND", "Poll not found"));
      const caller = createCaller();
      await expect(
        caller.poll.delete({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── castVote ──────────────────────────────────────────────────────

  describe("poll.castVote", () => {
    it("calls castVote with correct systemId and pollId", async () => {
      vi.mocked(castVote).mockResolvedValue(MOCK_VOTE_RESULT);
      const caller = createCaller();
      const result = await caller.poll.castVote({
        systemId: MOCK_SYSTEM_ID,
        pollId: POLL_ID,
        optionId: null,
        voter: { entityType: "member", entityId: "mem_aabbcc" },
        isVeto: false,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(castVote)).toHaveBeenCalledOnce();
      expect(vi.mocked(castVote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(castVote).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(result).toEqual(MOCK_VOTE_RESULT);
    });

    it("surfaces ApiHttpError(409) POLL_CLOSED as CONFLICT", async () => {
      vi.mocked(castVote).mockRejectedValue(new ApiHttpError(409, "POLL_CLOSED", "Poll is closed"));
      const caller = createCaller();
      await expect(
        caller.poll.castVote({
          systemId: MOCK_SYSTEM_ID,
          pollId: POLL_ID,
          optionId: null,
          voter: { entityType: "member", entityId: "mem_aabbcc" },
          isVeto: false,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── listVotes ─────────────────────────────────────────────────────

  describe("poll.listVotes", () => {
    it("calls listVotes with correct systemId and pollId", async () => {
      const mockResult = {
        data: [MOCK_VOTE_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listVotes).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.poll.listVotes({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID });

      expect(vi.mocked(listVotes)).toHaveBeenCalledOnce();
      expect(vi.mocked(listVotes).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(listVotes).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(result).toEqual(mockResult);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(listVotes).mockRejectedValue(new ApiHttpError(404, "NOT_FOUND", "Poll not found"));
      const caller = createCaller();
      await expect(
        caller.poll.listVotes({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── updateVote ────────────────────────────────────────────────────

  describe("poll.updateVote", () => {
    it("calls updatePollVote with correct ids", async () => {
      vi.mocked(updatePollVote).mockResolvedValue(MOCK_VOTE_RESULT);
      const caller = createCaller();
      const result = await caller.poll.updateVote({
        systemId: MOCK_SYSTEM_ID,
        pollId: POLL_ID,
        voteId: VOTE_ID,
        optionId: null,
        encryptedData: VALID_ENCRYPTED_DATA,
      });

      expect(vi.mocked(updatePollVote)).toHaveBeenCalledOnce();
      expect(vi.mocked(updatePollVote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updatePollVote).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(vi.mocked(updatePollVote).mock.calls[0]?.[3]).toBe(VOTE_ID);
      expect(result).toEqual(MOCK_VOTE_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(updatePollVote).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Vote not found"),
      );
      const caller = createCaller();
      await expect(
        caller.poll.updateVote({
          systemId: MOCK_SYSTEM_ID,
          pollId: POLL_ID,
          voteId: VOTE_ID,
          optionId: null,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("surfaces ApiHttpError(409) POLL_CLOSED as CONFLICT", async () => {
      vi.mocked(updatePollVote).mockRejectedValue(
        new ApiHttpError(409, "POLL_CLOSED", "Poll is closed"),
      );
      const caller = createCaller();
      await expect(
        caller.poll.updateVote({
          systemId: MOCK_SYSTEM_ID,
          pollId: POLL_ID,
          voteId: VOTE_ID,
          optionId: null,
          encryptedData: VALID_ENCRYPTED_DATA,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── deleteVote ────────────────────────────────────────────────────

  describe("poll.deleteVote", () => {
    it("calls deletePollVote and returns success", async () => {
      vi.mocked(deletePollVote).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.poll.deleteVote({
        systemId: MOCK_SYSTEM_ID,
        pollId: POLL_ID,
        voteId: VOTE_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deletePollVote)).toHaveBeenCalledOnce();
      expect(vi.mocked(deletePollVote).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(deletePollVote).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(vi.mocked(deletePollVote).mock.calls[0]?.[3]).toBe(VOTE_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deletePollVote).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Poll vote not found"),
      );
      const caller = createCaller();
      await expect(
        caller.poll.deleteVote({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID, voteId: VOTE_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── results ───────────────────────────────────────────────────────

  describe("poll.results", () => {
    it("calls getPollResults with correct systemId and pollId", async () => {
      const mockResults = {
        pollId: POLL_ID,
        totalVotes: 3,
        vetoCount: 0,
        optionCounts: [{ optionId: "opt_abc", count: 3 }],
      };
      vi.mocked(getPollResults).mockResolvedValue(mockResults);
      const caller = createCaller();
      const result = await caller.poll.results({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID });

      expect(vi.mocked(getPollResults)).toHaveBeenCalledOnce();
      expect(vi.mocked(getPollResults).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getPollResults).mock.calls[0]?.[2]).toBe(POLL_ID);
      expect(result).toEqual(mockResults);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getPollResults).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
      );
      const caller = createCaller();
      await expect(
        caller.poll.results({ systemId: MOCK_SYSTEM_ID, pollId: POLL_ID }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });
  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listPolls).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.poll.list({ systemId: MOCK_SYSTEM_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createPoll).mockResolvedValue(MOCK_POLL_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.poll.create({
          systemId: MOCK_SYSTEM_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          kind: "standard",
          createdByMemberId: undefined,
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
        }),
      "write",
    );
  });
});
