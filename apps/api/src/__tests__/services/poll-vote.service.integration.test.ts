import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  createPgCommunicationTables,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId, toUnixMillis } from "@pluralscape/types";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { archivePoll } from "../../services/poll/archive.js";
import { createPoll } from "../../services/poll/create.js";
import { castVote } from "../../services/poll-vote/cast.js";
import { listVotes } from "../../services/poll-vote/list.js";
import {
  assertApiError,
  asDb,
  makeAuth,
  genPollId,
  noopAudit,
  spyAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { PollResult } from "../../services/poll/internal.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { CastVoteBodySchema, CreatePollBodySchema } from "@pluralscape/validation";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { z } from "zod/v4";

const { polls, pollVotes } = schema;

type PollBody = z.infer<typeof CreatePollBodySchema>;
type VoteBody = z.infer<typeof CastVoteBodySchema>;

function makePollParams(overrides: Partial<PollBody> = {}): PollBody {
  return {
    encryptedData: testEncryptedDataBase64(),
    kind: "standard",
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
    createdByMemberId: undefined,
    ...overrides,
  };
}

function makeVoteParams(overrides: Partial<VoteBody> = {}): VoteBody {
  return {
    encryptedData: testEncryptedDataBase64(),
    voter: { entityType: "member", entityId: `mem_${crypto.randomUUID()}` },
    optionId: `po_${crypto.randomUUID()}`,
    isVeto: false,
    ...overrides,
  };
}

describe("poll-vote.service (PGlite integration)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let accountId: AccountId;
  let systemId: SystemId;
  let memberId: string;
  let auth: AuthContext;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });
    await createPgCommunicationTables(client);

    accountId = brandId<AccountId>(await pgInsertAccount(db));
    systemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
    const memId = `mem_${crypto.randomUUID()}`;
    memberId = await pgInsertMember(db, systemId, memId);
    auth = makeAuth(accountId, systemId);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(pollVotes);
    await db.delete(polls);
  });

  /** Helper to create an open poll with given overrides. */
  async function createTestPoll(overrides: Record<string, unknown> = {}): Promise<PollResult> {
    return createPoll(asDb(db), systemId, makePollParams(overrides), auth, noopAudit);
  }

  // ── CAST VOTE ──────────────────────────────────────────────────

  describe("castVote", () => {
    it("casts vote with member voter — returns expected shape", async () => {
      const poll = await createTestPoll();
      const voter = { entityType: "member" as const, entityId: memberId };
      const optionId = `po_${crypto.randomUUID()}`;

      const result = await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ voter, optionId }),
        auth,
        noopAudit,
      );

      expect(result.id).toMatch(/^pv_/);
      expect(result.pollId).toBe(poll.id);
      expect(result.optionId).toBe(optionId);
      expect(result.voter).toEqual(voter);
      expect(result.isVeto).toBe(false);
      expect(result.votedAt).toEqual(expect.any(Number));
      expect(result.encryptedData).toEqual(expect.any(String));
      expect(result.archived).toBe(false);
      expect(result.archivedAt).toBeNull();
      expect(result.createdAt).toEqual(expect.any(Number));
    });

    it("casts vote with structure-entity voter", async () => {
      const poll = await createTestPoll();
      const voter = {
        entityType: "structure-entity" as const,
        entityId: `ste_${crypto.randomUUID()}`,
      };

      const result = await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ voter }),
        auth,
        noopAudit,
      );

      expect(result.voter).toEqual(voter);
    });

    it("casts abstain vote (optionId null) when allowAbstain=true", async () => {
      const poll = await createTestPoll({ allowAbstain: true });

      const result = await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ optionId: null }),
        auth,
        noopAudit,
      );

      expect(result.optionId).toBeNull();
    });

    it("rejects abstain when allowAbstain=false (ABSTAIN_NOT_ALLOWED, 409)", async () => {
      const poll = await createTestPoll({ allowAbstain: false });

      await assertApiError(
        castVote(asDb(db), systemId, poll.id, makeVoteParams({ optionId: null }), auth, noopAudit),
        "ABSTAIN_NOT_ALLOWED",
        409,
      );
    });

    it("casts veto vote when allowVeto=true", async () => {
      const poll = await createTestPoll({ allowVeto: true });

      const result = await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ isVeto: true, optionId: `po_${crypto.randomUUID()}` }),
        auth,
        noopAudit,
      );

      expect(result.isVeto).toBe(true);
    });

    it("rejects veto when allowVeto=false (VETO_NOT_ALLOWED, 409)", async () => {
      const poll = await createTestPoll({ allowVeto: false });

      await assertApiError(
        castVote(
          asDb(db),
          systemId,
          poll.id,
          makeVoteParams({ isVeto: true, optionId: `po_${crypto.randomUUID()}` }),
          auth,
          noopAudit,
        ),
        "VETO_NOT_ALLOWED",
        409,
      );
    });

    it("enforces maxVotesPerMember — casts up to limit, rejects at limit", async () => {
      const poll = await createTestPoll({ maxVotesPerMember: 1 });
      const voter = { entityType: "member" as const, entityId: memberId };

      // First vote succeeds
      await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ voter, optionId: `po_${crypto.randomUUID()}` }),
        auth,
        noopAudit,
      );

      // Second vote for same voter rejected
      await assertApiError(
        castVote(
          asDb(db),
          systemId,
          poll.id,
          makeVoteParams({ voter, optionId: `po_${crypto.randomUUID()}` }),
          auth,
          noopAudit,
        ),
        "TOO_MANY_VOTES",
        409,
      );
    });

    it("different voters can independently vote (per-voter enforcement)", async () => {
      const poll = await createTestPoll({ maxVotesPerMember: 1 });
      const voterA = { entityType: "member" as const, entityId: `mem_${crypto.randomUUID()}` };
      const voterB = { entityType: "member" as const, entityId: `mem_${crypto.randomUUID()}` };

      const resultA = await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ voter: voterA, optionId: `po_${crypto.randomUUID()}` }),
        auth,
        noopAudit,
      );

      const resultB = await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ voter: voterB, optionId: `po_${crypto.randomUUID()}` }),
        auth,
        noopAudit,
      );

      expect(resultA.id).not.toBe(resultB.id);
    });

    it("rejects vote on closed poll (POLL_CLOSED, 409)", async () => {
      const { closePoll } = await import("../../services/poll/close.js");
      const poll = await createTestPoll();
      await closePoll(asDb(db), systemId, poll.id, auth, noopAudit);

      await assertApiError(
        castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, noopAudit),
        "POLL_CLOSED",
        409,
      );
    });

    it("rejects vote on nonexistent poll (NOT_FOUND, 404)", async () => {
      await assertApiError(
        castVote(asDb(db), systemId, genPollId(), makeVoteParams(), auth, noopAudit),
        "NOT_FOUND",
        404,
      );
    });

    it("writes audit 'poll-vote.cast'", async () => {
      const poll = await createTestPoll();
      const audit = spyAudit();

      await castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, audit);

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll-vote.cast");
    });

    it("writes audit 'poll-vote.vetoed' for veto vote", async () => {
      const poll = await createTestPoll({ allowVeto: true });
      const audit = spyAudit();

      await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ isVeto: true, optionId: `po_${crypto.randomUUID()}` }),
        auth,
        audit,
      );

      expect(audit.calls).toHaveLength(1);
      expect(audit.calls[0]?.eventType).toBe("poll-vote.vetoed");
    });

    it("allows multiple votes when maxVotesPerMember > 1", async () => {
      const poll = await createTestPoll({ allowMultipleVotes: true, maxVotesPerMember: 3 });
      const voter = { entityType: "member" as const, entityId: memberId };

      for (let i = 0; i < 3; i++) {
        await castVote(
          asDb(db),
          systemId,
          poll.id,
          makeVoteParams({ voter, optionId: `po_${crypto.randomUUID()}` }),
          auth,
          noopAudit,
        );
      }

      // Fourth vote should fail
      await assertApiError(
        castVote(
          asDb(db),
          systemId,
          poll.id,
          makeVoteParams({ voter, optionId: `po_${crypto.randomUUID()}` }),
          auth,
          noopAudit,
        ),
        "TOO_MANY_VOTES",
        409,
      );
    });

    it("enforces allowMultipleVotes=false — rejects second vote", async () => {
      const poll = await createTestPoll({ allowMultipleVotes: false, maxVotesPerMember: 1 });
      const voter = { entityType: "member" as const, entityId: `mem_${crypto.randomUUID()}` };

      await castVote(
        asDb(db),
        systemId,
        poll.id,
        makeVoteParams({ voter, optionId: `po_${crypto.randomUUID()}` }),
        auth,
        noopAudit,
      );

      await assertApiError(
        castVote(
          asDb(db),
          systemId,
          poll.id,
          makeVoteParams({ voter, optionId: `po_${crypto.randomUUID()}` }),
          auth,
          noopAudit,
        ),
        "TOO_MANY_VOTES",
        409,
      );
    });

    it("rejects vote on expired poll (endsAt in the past)", async () => {
      const poll = await createTestPoll({ endsAt: Date.now() - 60_000 });

      await assertApiError(
        castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, noopAudit),
        "POLL_CLOSED",
        409,
      );
    });

    it("accepts vote on poll with future endsAt", async () => {
      const poll = await createTestPoll({ endsAt: Date.now() + 86_400_000 });

      const result = await castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, noopAudit);

      expect(result.id).toMatch(/^pv_/);
      expect(result.pollId).toBe(poll.id);
    });
  });

  // ── CROSS-SYSTEM ISOLATION ──────────────────────────────────────

  describe("cross-system isolation", () => {
    it("cannot access another system's poll votes by poll ID", async () => {
      const poll = await createTestPoll();
      await castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, noopAudit);

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);

      await assertApiError(
        listVotes(asDb(db), otherSystemId, poll.id, otherAuth),
        "NOT_FOUND",
        404,
      );
    });

    it("list does not return another system's votes", async () => {
      const pollA = await createTestPoll();
      await castVote(asDb(db), systemId, pollA.id, makeVoteParams(), auth, noopAudit);

      const otherSystemId = brandId<SystemId>(await pgInsertSystem(db, accountId));
      const otherAuth = makeAuth(accountId, otherSystemId);
      const pollB = await createPoll(
        asDb(db),
        otherSystemId,
        makePollParams(),
        otherAuth,
        noopAudit,
      );

      const result = await listVotes(asDb(db), otherSystemId, pollB.id, otherAuth);
      expect(result.data).toHaveLength(0);
    });
  });

  // ── LIST VOTES ─────────────────────────────────────────────────

  describe("listVotes", () => {
    it("lists votes for a poll", async () => {
      const poll = await createTestPoll();
      await castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, noopAudit);
      await castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, noopAudit);

      const result = await listVotes(asDb(db), systemId, poll.id, auth);

      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it("supports cursor pagination", async () => {
      const poll = await createTestPoll({ allowMultipleVotes: true, maxVotesPerMember: 5 });
      const voter = { entityType: "member" as const, entityId: memberId };

      for (let i = 0; i < 3; i++) {
        await castVote(asDb(db), systemId, poll.id, makeVoteParams({ voter }), auth, noopAudit);
      }

      const page1 = await listVotes(asDb(db), systemId, poll.id, auth, { limit: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await listVotes(asDb(db), systemId, poll.id, auth, {
        cursor: page1.nextCursor ?? undefined,
        limit: 2,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);

      const allIds = [...page1.data.map((v) => v.id), ...page2.data.map((v) => v.id)];
      expect(new Set(allIds).size).toBe(3);
    });

    it("returns empty list when no votes", async () => {
      const poll = await createTestPoll();

      const result = await listVotes(asDb(db), systemId, poll.id, auth);

      expect(result.data).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("excludes archived by default", async () => {
      const poll = await createTestPoll();
      await castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, noopAudit);

      // Archive the vote directly via raw update
      await db.update(pollVotes).set({ archived: true, archivedAt: toUnixMillis(Date.now()) });

      const result = await listVotes(asDb(db), systemId, poll.id, auth);
      expect(result.data).toHaveLength(0);

      const withArchived = await listVotes(asDb(db), systemId, poll.id, auth, {
        includeArchived: true,
      });
      expect(withArchived.data).toHaveLength(1);
      expect(withArchived.data[0]?.archived).toBe(true);
    });

    it("returns NOT_FOUND for nonexistent poll", async () => {
      await assertApiError(listVotes(asDb(db), systemId, genPollId(), auth), "NOT_FOUND", 404);
    });

    it("returns NOT_FOUND for archived poll when includeArchived=false", async () => {
      const poll = await createTestPoll();
      await archivePoll(asDb(db), systemId, poll.id, auth, noopAudit);

      await assertApiError(listVotes(asDb(db), systemId, poll.id, auth), "NOT_FOUND", 404);
    });

    it("lists votes for archived poll when includeArchived=true", async () => {
      const poll = await createTestPoll();
      await castVote(asDb(db), systemId, poll.id, makeVoteParams(), auth, noopAudit);
      await archivePoll(asDb(db), systemId, poll.id, auth, noopAudit);

      const result = await listVotes(asDb(db), systemId, poll.id, auth, {
        includeArchived: true,
      });

      expect(result.data).toHaveLength(1);
    });

    it("returns INVALID_CURSOR for garbage cursor string", async () => {
      const poll = await createTestPoll();

      await assertApiError(
        listVotes(asDb(db), systemId, poll.id, auth, { cursor: "not-a-valid-cursor" }),
        "INVALID_CURSOR",
        400,
      );
    });
  });
});
