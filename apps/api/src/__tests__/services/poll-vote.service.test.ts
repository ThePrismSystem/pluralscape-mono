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

const { castVote, listVotes } = await import("../../services/poll-vote.service.js");

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

// ── Tests ────────────────────────────────────────────────────────────

describe("poll-vote service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockAudit.mockClear();
  });

  // ── castVote ───────────────────────────────────────────────────

  describe("castVote", () => {
    const validPayload = {
      encryptedData: VALID_BLOB_BASE64,
      optionId: null,
      voter: VALID_VOTER,
      isVeto: false,
    };

    /**
     * castVote query flow:
     *   1. select().from(polls).where().limit(1).for("update") — poll fetch
     *   2. select({count}).from(pollVotes).where(and(..., sql`...`)) — vote count
     *   3. insert().values().returning() — insert vote
     *
     * Because where() call 1 returns the chain (for .limit() chaining) but
     * call 2 must resolve directly, we track call count in mockImplementation.
     */
    function mockCastVoteChain(
      chain: ReturnType<typeof mockDb>["chain"],
      pollData: Record<string, unknown>[],
      existingVoteCount: number,
    ): void {
      // .limit() call 1 must return chain (so .for() can be chained)
      chain.limit.mockReturnValueOnce(chain);
      // .for() resolves to poll data
      chain.for.mockResolvedValueOnce(pollData);
      // The vote count query ends at .where() — track with a call counter
      let whereCallCount = 0;
      chain.where.mockImplementation((): unknown => {
        whereCallCount++;
        if (whereCallCount === 2) {
          // Second where call: vote count query (no .limit() follows)
          return Promise.resolve([{ count: existingVoteCount }]);
        }
        return chain;
      });
    }

    it("casts a vote successfully and returns result", async () => {
      const { db, chain } = mockDb();
      mockCastVoteChain(chain, [makePollRow()], 0);
      chain.returning.mockResolvedValueOnce([makeVoteRow()]);

      const result = await castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit);

      expect(result.id).toBe(VOTE_ID);
      expect(result.isVeto).toBe(false);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "poll-vote.cast" }),
      );
    });

    it("throws VALIDATION_ERROR for invalid payload", async () => {
      const { db } = mockDb();

      await expect(
        castVote(db, SYSTEM_ID, POLL_ID, { bad: true }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 400, code: "VALIDATION_ERROR" }));
    });

    it("throws NOT_FOUND when poll not found", async () => {
      const { db, chain } = mockDb();
      // .limit() → chain, .for() → empty poll data
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([]);

      await expect(castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("throws POLL_CLOSED when poll status is closed", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([makePollRow({ status: "closed" })]);

      await expect(castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "POLL_CLOSED" }),
      );
    });

    it("throws POLL_CLOSED when poll endsAt has passed", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([makePollRow({ endsAt: 500 })]);
      // now() is mocked to return 1000, which is > 500

      await expect(castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 409, code: "POLL_CLOSED" }),
      );
    });

    it("throws ABSTAIN_NOT_ALLOWED when optionId is null and abstain is disabled", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([makePollRow({ allowAbstain: false })]);

      await expect(
        castVote(db, SYSTEM_ID, POLL_ID, { ...validPayload, optionId: null }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "ABSTAIN_NOT_ALLOWED" }));
    });

    it("casts an abstain vote successfully when allowAbstain is enabled", async () => {
      const { db, chain } = mockDb();
      mockCastVoteChain(chain, [makePollRow({ allowAbstain: true })], 0);
      chain.returning.mockResolvedValueOnce([makeVoteRow({ optionId: null })]);

      const result = await castVote(
        db,
        SYSTEM_ID,
        POLL_ID,
        { ...validPayload, optionId: null },
        AUTH,
        mockAudit,
      );

      expect(result.id).toBe(VOTE_ID);
      expect(result.optionId).toBeNull();
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "poll-vote.cast" }),
      );
    });

    it("throws VETO_NOT_ALLOWED when isVeto is true and veto is disabled", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockReturnValueOnce(chain);
      chain.for.mockResolvedValueOnce([makePollRow({ allowVeto: false })]);

      await expect(
        castVote(
          db,
          SYSTEM_ID,
          POLL_ID,
          { ...validPayload, optionId: "opt_1", isVeto: true },
          AUTH,
          mockAudit,
        ),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "VETO_NOT_ALLOWED" }));
    });

    it("throws TOO_MANY_VOTES when voter has reached vote limit", async () => {
      const { db, chain } = mockDb();
      mockCastVoteChain(chain, [makePollRow({ allowMultipleVotes: false })], 1);

      await expect(
        castVote(db, SYSTEM_ID, POLL_ID, { ...validPayload, optionId: "opt_1" }, AUTH, mockAudit),
      ).rejects.toThrow(expect.objectContaining({ status: 409, code: "TOO_MANY_VOTES" }));
    });

    it("records veto audit event when isVeto is true", async () => {
      const { db, chain } = mockDb();
      mockCastVoteChain(chain, [makePollRow()], 0);
      chain.returning.mockResolvedValueOnce([makeVoteRow({ isVeto: true })]);

      const result = await castVote(
        db,
        SYSTEM_ID,
        POLL_ID,
        { ...validPayload, optionId: "opt_1", isVeto: true },
        AUTH,
        mockAudit,
      );

      expect(result.isVeto).toBe(true);
      expect(mockAudit).toHaveBeenCalledWith(
        chain,
        expect.objectContaining({ eventType: "poll-vote.vetoed" }),
      );
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(castVote(db, SYSTEM_ID, POLL_ID, validPayload, AUTH, mockAudit)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });

  // ── listVotes ──────────────────────────────────────────────────

  describe("listVotes", () => {
    it("returns paginated votes for a poll", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: POLL_ID }]); // poll exists check
      chain.limit.mockResolvedValueOnce([makeVoteRow()]); // votes

      const result = await listVotes(db, SYSTEM_ID, POLL_ID, AUTH);

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it("throws 404 when poll not found", async () => {
      const { db } = mockDb();
      // chain.limit defaults to [] — poll not found

      await expect(listVotes(db, SYSTEM_ID, POLL_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });

    it("detects hasMore when more votes exist than limit", async () => {
      const { db, chain } = mockDb();
      chain.limit.mockResolvedValueOnce([{ id: POLL_ID }]);
      const rows = [makeVoteRow({ id: "pv_a" }), makeVoteRow({ id: "pv_b" })];
      chain.limit.mockResolvedValueOnce(rows);

      const result = await listVotes(db, SYSTEM_ID, POLL_ID, AUTH, { limit: 1 });

      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("throws 404 on ownership failure", async () => {
      const { db } = mockDb();
      mockOwnershipFailure(vi.mocked(assertSystemOwnership));

      await expect(listVotes(db, SYSTEM_ID, POLL_ID, AUTH)).rejects.toThrow(
        expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
      );
    });
  });
});
