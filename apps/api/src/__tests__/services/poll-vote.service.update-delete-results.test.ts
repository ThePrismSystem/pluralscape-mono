import { brandId } from "@pluralscape/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";
import { mockOwnershipFailure } from "../helpers/mock-ownership.js";
import { makeTestAuth } from "../helpers/test-auth.js";

import type { PollId, PollVoteId, SystemId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@pluralscape/crypto", () => ({
  serializeEncryptedBlob: vi.fn(() => new Uint8Array([1, 2, 3])),
  deserializeEncryptedBlob: vi.fn((data: Uint8Array) => ({
    tier: 1,
    algorithm: "xchacha20-poly1305",
    keyVersion: null,
    bucketId: null,
    nonce: new Uint8Array(24),
    ciphertext: new Uint8Array(data.slice(32)),
  })),
  InvalidInputError: class InvalidInputError extends Error {
    override readonly name = "InvalidInputError" as const;
  },
}));

vi.mock("../../lib/system-ownership.js", () => ({
  assertSystemOwnership: vi.fn(),
}));

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
}));

vi.mock("@pluralscape/db/pg", () => ({
  polls: {
    id: "id",
    systemId: "system_id",
    status: "status",
    endsAt: "ends_at",
    allowAbstain: "allow_abstain",
    allowVeto: "allow_veto",
    allowMultipleVotes: "allow_multiple_votes",
    maxVotesPerMember: "max_votes_per_member",
    archived: "archived",
    optionId: "option_id",
    isVeto: "is_veto",
  },
  pollVotes: {
    id: "id",
    systemId: "system_id",
    pollId: "poll_id",
    optionId: "option_id",
    voter: "voter",
    isVeto: "is_veto",
    votedAt: "voted_at",
    encryptedData: "encrypted_data",
    archived: "archived",
    archivedAt: "archived_at",
    createdAt: "created_at",
  },
}));

vi.mock("@pluralscape/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/types")>();
  return {
    ...actual,
    createId: vi.fn().mockReturnValue("pv_test-id"),
    now: vi.fn().mockReturnValue(1000),
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((a: unknown, b: unknown) => [a, b]),
    lt: vi.fn((a: unknown, b: unknown) => ["lt", a, b]),
    or: vi.fn((...args: unknown[]) => args),
    count: vi.fn(() => ({ count: "count" })),
    desc: vi.fn((a: unknown) => ["desc", a]),
    sql: Object.assign(vi.fn(), { join: vi.fn() }),
  };
});

// ── Imports after mocks ──────────────────────────────────────────────

const { assertSystemOwnership } = await import("../../lib/system-ownership.js");
const { castVote } = await import("../../services/poll-vote/cast.js");
const { listVotes, parsePollVoteQuery } = await import("../../services/poll-vote/list.js");
const { updatePollVote } = await import("../../services/poll-vote/update.js");
const { deletePollVote } = await import("../../services/poll-vote/archive.js");
const { getPollResults } = await import("../../services/poll-vote/results.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const SYSTEM_ID = brandId<SystemId>("sys_test-system");
const POLL_ID = brandId<PollId>("pl_test-poll");
const VOTE_ID = brandId<PollVoteId>("pv_test-vote");
const AUTH = makeTestAuth({ systemId: SYSTEM_ID });
const mockAudit = vi.fn().mockResolvedValue(undefined);

const VALID_BLOB_BASE64 = Buffer.from(new Uint8Array(40)).toString("base64");
const VALID_VOTER = { entityType: "member" as const, entityId: "mem_test" };

function makePollRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: POLL_ID,
    systemId: SYSTEM_ID,
    status: "open",
    endsAt: null,
    allowAbstain: true,
    allowVeto: true,
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    archived: false,
    ...overrides,
  };
}

function makeVoteRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: VOTE_ID,
    pollId: POLL_ID,
    systemId: SYSTEM_ID,
    optionId: null,
    voter: VALID_VOTER,
    isVeto: false,
    votedAt: 1000,
    encryptedData: new Uint8Array([1, 2, 3]),
    archived: false,
    archivedAt: null,
    createdAt: 1000,
    ...overrides,
  };
}

// ── updatePollVote ──────────────────────────────────────────────────

describe("updatePollVote", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  const validUpdatePayload = {
    optionId: "opt_new",
    isVeto: false,
    encryptedData: VALID_BLOB_BASE64,
  };

  /**
   * updatePollVote query chain:
   *   1. select().from(pollVotes).where().for("update").limit(1) — existing vote
   *   2. select().from(polls).where().limit(1) — parent poll
   *   3. update().set().where().returning() — updated vote
   *
   * The chain order is where → for → limit, so .for() must return chain
   * and the first .limit() resolves to the existing vote data.
   */
  function mockUpdateVoteChain(
    chain: ReturnType<typeof mockDb>["chain"],
    existingVote: Record<string, unknown>[],
    pollData: Record<string, unknown>[],
  ): void {
    // .for("update") returns chain so .limit() can be chained
    chain.for.mockReturnValueOnce(chain);
    // First .limit() resolves to existing vote
    chain.limit.mockResolvedValueOnce(existingVote);
    // Second .limit() resolves to poll data
    chain.limit.mockResolvedValueOnce(pollData);
  }

  it("updates a vote successfully", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow()], [makePollRow()]);
    chain.returning.mockResolvedValueOnce([makeVoteRow({ optionId: "opt_new" })]);

    const result = await updatePollVote(
      db,
      SYSTEM_ID,
      POLL_ID,
      VOTE_ID,
      validUpdatePayload,
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(VOTE_ID);
    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "poll-vote.updated" }),
    );
  });

  it("throws NOT_FOUND when vote does not exist", async () => {
    const { db, chain } = mockDb();
    // .for() → chain, .limit() → empty (vote not found)
    chain.for.mockReturnValueOnce(chain);
    chain.limit.mockResolvedValueOnce([]);

    await expect(
      updatePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws NOT_FOUND when poll not found", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow()], []);

    await expect(
      updatePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("throws POLL_CLOSED when poll status is closed", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow()], [makePollRow({ status: "closed" })]);

    await expect(
      updatePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "POLL_CLOSED" }));
  });

  it("throws POLL_CLOSED when poll endsAt has passed", async () => {
    const { db, chain } = mockDb();
    // now() mocked to 1000, endsAt=500 means poll has ended
    mockUpdateVoteChain(chain, [makeVoteRow()], [makePollRow({ endsAt: 500 })]);

    await expect(
      updatePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "POLL_CLOSED" }));
  });

  it("throws VETO_NOT_ALLOWED when isVeto is true and poll disallows veto", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow()], [makePollRow({ allowVeto: false })]);

    await expect(
      updatePollVote(
        db,
        SYSTEM_ID,
        POLL_ID,
        VOTE_ID,
        { ...validUpdatePayload, isVeto: true },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "VETO_NOT_ALLOWED" }));
  });

  it("throws ABSTAIN_NOT_ALLOWED when optionId is null and poll disallows abstain", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow()], [makePollRow({ allowAbstain: false })]);

    await expect(
      updatePollVote(
        db,
        SYSTEM_ID,
        POLL_ID,
        VOTE_ID,
        { ...validUpdatePayload, optionId: null },
        AUTH,
        mockAudit,
      ),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ABSTAIN_NOT_ALLOWED" }));
  });

  it("throws VALIDATION_ERROR for invalid payload", async () => {
    const { db } = mockDb();

    await expect(
      updatePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, { bad: true }, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
  });

  it("throws internal error when UPDATE returns no rows", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow()], [makePollRow()]);
    chain.returning.mockResolvedValueOnce([]);

    await expect(
      updatePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow("Failed to update poll vote");
  });

  it("preserves existing isVeto when isVeto is undefined in update", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow({ isVeto: true })], [makePollRow()]);
    chain.returning.mockResolvedValueOnce([makeVoteRow({ isVeto: true, optionId: "opt_new" })]);

    const result = await updatePollVote(
      db,
      SYSTEM_ID,
      POLL_ID,
      VOTE_ID,
      { optionId: "opt_new", encryptedData: VALID_BLOB_BASE64 },
      AUTH,
      mockAudit,
    );

    expect(result.isVeto).toBe(true);
  });

  it("throws 404 on ownership failure", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(
      updatePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, validUpdatePayload, AUTH, mockAudit),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: "NOT_FOUND" }));
  });

  it("allows update when poll endsAt is null (no expiry)", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow()], [makePollRow({ endsAt: null })]);
    chain.returning.mockResolvedValueOnce([makeVoteRow({ optionId: "opt_new" })]);

    const result = await updatePollVote(
      db,
      SYSTEM_ID,
      POLL_ID,
      VOTE_ID,
      validUpdatePayload,
      AUTH,
      mockAudit,
    );

    expect(result.id).toBe(VOTE_ID);
  });

  it("allows veto update when poll allows veto", async () => {
    const { db, chain } = mockDb();
    mockUpdateVoteChain(chain, [makeVoteRow()], [makePollRow({ allowVeto: true })]);
    chain.returning.mockResolvedValueOnce([makeVoteRow({ isVeto: true })]);

    const result = await updatePollVote(
      db,
      SYSTEM_ID,
      POLL_ID,
      VOTE_ID,
      { ...validUpdatePayload, isVeto: true },
      AUTH,
      mockAudit,
    );

    expect(result.isVeto).toBe(true);
  });
});

// ── deletePollVote ─────────────────────────────────────────────────

describe("deletePollVote", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  it("archives the vote successfully", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: VOTE_ID, archived: false }]);

    await deletePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, AUTH, mockAudit);

    expect(mockAudit).toHaveBeenCalledWith(
      chain,
      expect.objectContaining({ eventType: "poll-vote.archived" }),
    );
  });

  it("throws NOT_FOUND when vote does not exist", async () => {
    const { db } = mockDb();
    // chain.limit defaults to [] — vote not found

    await expect(deletePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws ALREADY_ARCHIVED when vote is already archived", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: VOTE_ID, archived: true }]);

    await expect(deletePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "ALREADY_ARCHIVED" }),
    );
  });

  it("throws 404 on ownership failure", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(deletePollVote(db, SYSTEM_ID, POLL_ID, VOTE_ID, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });
});

// ── getPollResults ──────────────────────────────────────────────────

describe("getPollResults", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * getPollResults query flow:
   *   1. tx.select({id}).from(polls).where().limit(1)          — poll exists
   *   2. tx.select({optionId,count}).from(pollVotes).where().groupBy() — option counts
   *   3. tx.select({count}).from(pollVotes).where()             — veto count
   *
   * Query 2 ends at .groupBy(), query 3 ends at .where().
   * We track where() call count to resolve query 3 directly.
   */
  function mockPollResultsChain(
    chain: ReturnType<typeof mockDb>["chain"],
    pollExists: boolean,
    optionRows: { optionId: string | null; count: number }[],
    vetoCount: number,
  ): void {
    // Query 1: poll exists
    chain.limit.mockResolvedValueOnce(pollExists ? [{ id: POLL_ID }] : []);

    if (!pollExists) return;

    // Query 2: groupBy resolves to option rows
    chain.groupBy.mockResolvedValueOnce(optionRows);

    // Query 3: veto count — the 3rd where() call is terminal (returns count)
    // Use mockReturnValueOnce for chainable calls, then mockResolvedValueOnce for terminal
    chain.where
      .mockReturnValueOnce(chain) // 1st where: poll exists (chains to limit)
      .mockReturnValueOnce(chain) // 2nd where: option counts (chains to groupBy)
      .mockResolvedValueOnce([{ count: vetoCount }]); // 3rd where: veto count (terminal)
  }

  it("returns aggregated results for a poll with votes", async () => {
    const { db, chain } = mockDb();
    mockPollResultsChain(
      chain,
      true,
      [
        { optionId: "opt_a", count: 3 },
        { optionId: "opt_b", count: 2 },
        { optionId: null, count: 1 },
      ],
      1,
    );

    const result = await getPollResults(db, SYSTEM_ID, POLL_ID, AUTH);

    expect(result.pollId).toBe(POLL_ID);
    expect(result.totalVotes).toBe(6);
    expect(result.vetoCount).toBe(1);
    expect(result.optionCounts).toHaveLength(3);
  });

  it("returns zero totals for a poll with no votes", async () => {
    const { db, chain } = mockDb();
    mockPollResultsChain(chain, true, [], 0);

    const result = await getPollResults(db, SYSTEM_ID, POLL_ID, AUTH);

    expect(result.pollId).toBe(POLL_ID);
    expect(result.totalVotes).toBe(0);
    expect(result.vetoCount).toBe(0);
    expect(result.optionCounts).toHaveLength(0);
  });

  it("throws NOT_FOUND when poll does not exist", async () => {
    const { db, chain } = mockDb();
    mockPollResultsChain(chain, false, [], 0);

    await expect(getPollResults(db, SYSTEM_ID, POLL_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("throws 404 on ownership failure", async () => {
    const { db } = mockDb();
    mockOwnershipFailure(vi.mocked(assertSystemOwnership));

    await expect(getPollResults(db, SYSTEM_ID, POLL_ID, AUTH)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    );
  });

  it("handles vetoCount fallback when vetoRow is undefined", async () => {
    const { db, chain } = mockDb();

    // Poll exists
    chain.limit.mockResolvedValueOnce([{ id: POLL_ID }]);
    // Option counts
    chain.groupBy.mockResolvedValueOnce([{ optionId: "opt_a", count: 2 }]);
    // Veto count query resolves to empty array — vetoRow is undefined, falls back to 0
    let whereCallCount = 0;
    chain.where = vi.fn((): unknown => {
      whereCallCount++;
      if (whereCallCount === 3) {
        return Promise.resolve([]);
      }
      return chain;
    });

    const result = await getPollResults(db, SYSTEM_ID, POLL_ID, AUTH);

    expect(result.vetoCount).toBe(0);
    expect(result.totalVotes).toBe(2);
  });
});

// ── castVote additional branches ────────────────────────────────────

describe("castVote — additional branch coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  const validPayload = {
    encryptedData: VALID_BLOB_BASE64,
    optionId: "opt_1",
    voter: VALID_VOTER,
    isVeto: false,
  };

  function mockCastVoteChain(
    chain: ReturnType<typeof mockDb>["chain"],
    pollData: Record<string, unknown>[],
    existingVoteCount: number,
  ): void {
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce(pollData);
    let whereCallCount = 0;
    chain.where.mockImplementation((): unknown => {
      whereCallCount++;
      if (whereCallCount === 2) {
        return Promise.resolve([{ count: existingVoteCount }]);
      }
      return chain;
    });
  }

  it("throws internal error when INSERT returns no rows", async () => {
    const { db, chain } = mockDb();
    mockCastVoteChain(chain, [makePollRow()], 0);
    chain.returning.mockResolvedValueOnce([]);

    await expect(castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
      "Failed to cast vote",
    );
  });

  it("allows multiple votes when allowMultipleVotes is true and under maxVotesPerMember", async () => {
    const { db, chain } = mockDb();
    mockCastVoteChain(chain, [makePollRow({ allowMultipleVotes: true, maxVotesPerMember: 5 })], 3);
    chain.returning.mockResolvedValueOnce([makeVoteRow()]);

    const result = await castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit);

    expect(result.id).toBe(VOTE_ID);
  });

  it("throws TOO_MANY_VOTES when multiple votes allowed but limit reached", async () => {
    const { db, chain } = mockDb();
    mockCastVoteChain(chain, [makePollRow({ allowMultipleVotes: true, maxVotesPerMember: 3 })], 3);

    await expect(castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "TOO_MANY_VOTES" }),
    );
  });

  it("uses effectiveMax of 1 when allowMultipleVotes is false regardless of maxVotesPerMember", async () => {
    const { db, chain } = mockDb();
    // maxVotesPerMember is 5 but allowMultipleVotes is false, so effective max is 1
    mockCastVoteChain(chain, [makePollRow({ allowMultipleVotes: false, maxVotesPerMember: 5 })], 1);

    await expect(castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: "TOO_MANY_VOTES" }),
    );
  });

  it("handles voteCountResult being undefined by falling back to 0", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockReturnValueOnce(chain);
    chain.for.mockResolvedValueOnce([makePollRow()]);
    // Return empty array for vote count so voteCountResult is undefined
    let whereCallCount = 0;
    chain.where.mockImplementation((): unknown => {
      whereCallCount++;
      if (whereCallCount === 2) {
        return Promise.resolve([]);
      }
      return chain;
    });
    chain.returning.mockResolvedValueOnce([makeVoteRow()]);

    const result = await castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit);

    expect(result.id).toBe(VOTE_ID);
  });
});

// ── parsePollVoteQuery ──────────────────────────────────────────────

describe("parsePollVoteQuery", () => {
  it("returns includeArchived false by default", () => {
    const result = parsePollVoteQuery({});

    expect(result.includeArchived).toBe(false);
  });

  it("returns includeArchived true when query param is 'true'", () => {
    const result = parsePollVoteQuery({ includeArchived: "true" });

    expect(result.includeArchived).toBe(true);
  });

  it("returns includeArchived false when query param is 'false'", () => {
    const result = parsePollVoteQuery({ includeArchived: "false" });

    expect(result.includeArchived).toBe(false);
  });
});

// ── listVotes additional branches ───────────────────────────────────

describe("listVotes — includeArchived and cursor branches", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes archived votes when includeArchived is true", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: POLL_ID }]);
    chain.limit.mockResolvedValueOnce([makeVoteRow({ archived: true })]);

    const result = await listVotes(db, SYSTEM_ID, POLL_ID, AUTH, { includeArchived: true });

    expect(result.data).toHaveLength(1);
  });

  it("clamps limit to MAX_PAGE_LIMIT", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: POLL_ID }]);
    chain.limit.mockResolvedValueOnce([]);

    const result = await listVotes(db, SYSTEM_ID, POLL_ID, AUTH, { limit: 999_999 });

    expect(result.data).toHaveLength(0);
  });

  it("uses DEFAULT_PAGE_LIMIT when limit is undefined", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: POLL_ID }]);
    chain.limit.mockResolvedValueOnce([]);

    const result = await listVotes(db, SYSTEM_ID, POLL_ID, AUTH);

    expect(result.data).toHaveLength(0);
  });
});
