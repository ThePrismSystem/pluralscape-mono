/**
 * Integration tests for the guard-logic invariants that prevent double-action
 * outcomes under concurrent invocation:
 *
 *   • `castVote`           — one-vote-per-voter poll
 *   • `generateFriendCode` — per-account friend-code quota
 *   • `redeemFriendCode`   — one-redemption-per-code
 *   • `updateImportJob`    — state-machine transitions (illegal transitions
 *                            rejected, same-state updates permitted)
 *
 * These tests run against PGlite, which serializes transactions at the event
 * loop. They do NOT prove `SELECT … FOR UPDATE` lock behavior — that is a
 * PostgreSQL contract, and its actual contention semantics are exercised by
 * the companion E2E suite at
 * `apps/api-e2e/src/tests/concurrency/lock-contention.spec.ts`. This file
 * regresses the *guard logic* end-to-end against the full schema under the
 * same concurrent-call shape the E2E uses.
 */

import { PGlite } from "@electric-sql/pglite";
import * as schema from "@pluralscape/db/pg";
import {
  PG_DDL,
  pgInsertAccount,
  pgInsertMember,
  pgInsertSystem,
} from "@pluralscape/db/test-helpers/pg-helpers";
import { brandId } from "@pluralscape/types";
import { CastVoteBodySchema } from "@pluralscape/validation";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("../../services/webhook-dispatcher.js", () => ({
  dispatchWebhookEvent: vi.fn().mockResolvedValue([]),
  invalidateWebhookConfigCache: vi.fn(),
  clearWebhookConfigCache: vi.fn(),
}));

import { ApiHttpError } from "../../lib/api-error.js";
import { MAX_FRIEND_CODES_PER_ACCOUNT } from "../../quota.constants.js";
import { generateFriendCode, redeemFriendCode } from "../../services/friend-code.service.js";
import { createPoll } from "../../services/poll/create.js";
import { castVote } from "../../services/poll/votes/cast.js";
import { createImportJob } from "../../services/system/import-jobs/create.js";
import { updateImportJob } from "../../services/system/import-jobs/update.js";
import {
  asDb,
  makeAuth,
  noopAudit,
  testEncryptedDataBase64,
} from "../helpers/integration-setup.js";

import type { AuthContext } from "../../lib/auth-context.js";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { PgliteDatabase } from "drizzle-orm/pglite";

const { friendCodes, friendConnections, importJobs, pollVotes, polls } = schema;

/**
 * Categorise `Promise.allSettled` results into fulfilled vs. rejected with
 * the rejection surfaced as `ApiHttpError` when it is one.
 */
function partitionResults<T>(results: readonly PromiseSettledResult<T>[]): {
  readonly fulfilled: readonly T[];
  readonly apiErrors: readonly ApiHttpError[];
  readonly otherRejections: readonly unknown[];
} {
  const fulfilled: T[] = [];
  const apiErrors: ApiHttpError[] = [];
  const otherRejections: unknown[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      fulfilled.push(r.value);
    } else if (r.reason instanceof ApiHttpError) {
      apiErrors.push(r.reason);
    } else {
      otherRejections.push(r.reason);
    }
  }
  return { fulfilled, apiErrors, otherRejections };
}

describe("concurrent guard semantics", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  // Two account+system pairs for cross-account redemption tests.
  let accountIdA: AccountId;
  let systemIdA: SystemId;
  let authA: AuthContext;

  let accountIdB: AccountId;
  let systemIdB: SystemId;
  let authB: AuthContext;

  let memberId: string;

  beforeAll(async () => {
    client = await PGlite.create();
    db = drizzle(client, { schema });

    // Compose exactly the DDL we need across three domains (communication,
    // privacy, import-export) without going through the per-domain helpers
    // that would redundantly re-declare `accounts`/`systems` and fail.
    const stmts: readonly string[] = [
      // Base
      PG_DDL.accounts,
      PG_DDL.accountsIndexes,
      PG_DDL.systems,
      PG_DDL.systemsIndexes,
      // Communication (polls, votes)
      PG_DDL.members,
      PG_DDL.membersIndexes,
      PG_DDL.channels,
      PG_DDL.channelsIndexes,
      PG_DDL.polls,
      PG_DDL.pollsIndexes,
      PG_DDL.pollVotes,
      PG_DDL.pollVotesIndexes,
      // Webhook-dispatcher dependencies (mocked, but SELECT-preparation still runs)
      PG_DDL.apiKeys,
      PG_DDL.apiKeysIndexes,
      PG_DDL.webhookConfigs,
      PG_DDL.webhookConfigsIndexes,
      PG_DDL.webhookDeliveries,
      PG_DDL.webhookDeliveriesIndexes,
      // Privacy (friend codes / connections)
      PG_DDL.buckets,
      PG_DDL.bucketsIndexes,
      PG_DDL.friendConnections,
      PG_DDL.friendConnectionsIndexes,
      PG_DDL.friendCodes,
      PG_DDL.friendCodesIndexes,
      // Import/export
      PG_DDL.blobMetadata,
      PG_DDL.blobMetadataIndexes,
      PG_DDL.importJobs,
      PG_DDL.importJobsIndexes,
    ];
    for (const stmt of stmts) {
      for (const single of stmt.split(";\n").filter((s) => s.trim() !== "")) {
        await client.query(single);
      }
    }

    accountIdA = brandId<AccountId>(await pgInsertAccount(db));
    systemIdA = brandId<SystemId>(await pgInsertSystem(db, accountIdA));
    authA = makeAuth(accountIdA, systemIdA);
    memberId = await pgInsertMember(db, systemIdA, `mem_${crypto.randomUUID()}`);

    accountIdB = brandId<AccountId>(await pgInsertAccount(db));
    systemIdB = brandId<SystemId>(await pgInsertSystem(db, accountIdB));
    authB = makeAuth(accountIdB, systemIdB);
  });

  afterAll(async () => {
    await client.close();
  });

  afterEach(async () => {
    await db.delete(pollVotes);
    await db.delete(polls);
    await db.delete(friendConnections);
    await db.delete(friendCodes);
    await db.delete(importJobs);
  });

  // ── poll-vote.service: vote serialization ───────────────────────

  describe("poll vote serialization", () => {
    it("serializes concurrent vote attempts on the same poll without double-counting", async () => {
      const poll = await createPoll(
        asDb(db),
        systemIdA,
        {
          encryptedData: testEncryptedDataBase64(),
          kind: "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
        },
        authA,
        noopAudit,
      );

      const voter: z.input<typeof CastVoteBodySchema>["voter"] = {
        entityType: "member",
        entityId: memberId,
      };
      const voteParams = (): z.input<typeof CastVoteBodySchema> => ({
        encryptedData: testEncryptedDataBase64(),
        voter,
        // Distinct optionIds — irrelevant to the per-voter cap, but proves
        // the guard is per-voter and not per-option.
        optionId: `po_${crypto.randomUUID()}`,
        isVeto: false,
      });

      const results = await Promise.allSettled([
        castVote(asDb(db), systemIdA, poll.id, voteParams(), authA, noopAudit),
        castVote(asDb(db), systemIdA, poll.id, voteParams(), authA, noopAudit),
      ]);

      const { fulfilled, apiErrors, otherRejections } = partitionResults(results);

      expect(otherRejections).toEqual([]);
      expect(fulfilled).toHaveLength(1);
      expect(apiErrors).toHaveLength(1);
      expect(apiErrors[0]?.code).toBe("TOO_MANY_VOTES");
      expect(apiErrors[0]?.status).toBe(409);

      // Database reflects exactly one accepted vote for this voter.
      const voteRows = await db
        .select({ id: pollVotes.id })
        .from(pollVotes)
        .where(eq(pollVotes.pollId, poll.id));
      expect(voteRows).toHaveLength(1);
    });
  });

  // ── friend-code.service: quota check on generate ────────────────

  describe("friend code quota check", () => {
    it("prevents over-quota creation under concurrent generate calls", async () => {
      // Seed the account at quota - 1 so two more concurrent creates would
      // exceed the quota if the guard is racy.
      for (let i = 0; i < MAX_FRIEND_CODES_PER_ACCOUNT - 1; i++) {
        await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);
      }

      const results = await Promise.allSettled([
        generateFriendCode(asDb(db), accountIdA, authA, noopAudit),
        generateFriendCode(asDb(db), accountIdA, authA, noopAudit),
      ]);

      const { fulfilled, apiErrors, otherRejections } = partitionResults(results);

      expect(otherRejections).toEqual([]);
      // Exactly one attempt wins and pushes the account to the quota.
      expect(fulfilled).toHaveLength(1);
      expect(apiErrors).toHaveLength(1);
      expect(apiErrors[0]?.code).toBe("QUOTA_EXCEEDED");
      expect(apiErrors[0]?.status).toBe(400);

      const codeRows = await db
        .select({ id: friendCodes.id })
        .from(friendCodes)
        .where(eq(friendCodes.accountId, accountIdA));
      expect(codeRows).toHaveLength(MAX_FRIEND_CODES_PER_ACCOUNT);
    });
  });

  // ── friend-code.service: redemption serialization ───────────────

  describe("friend code redemption", () => {
    it("prevents double-redemption under concurrent redeem calls", async () => {
      // Account A owns the code; Account B redeems it.
      const codeResult = await generateFriendCode(asDb(db), accountIdA, authA, noopAudit);

      const results = await Promise.allSettled([
        redeemFriendCode(asDb(db), codeResult.code, authB, noopAudit),
        redeemFriendCode(asDb(db), codeResult.code, authB, noopAudit),
      ]);

      const { fulfilled, apiErrors, otherRejections } = partitionResults(results);

      expect(otherRejections).toEqual([]);
      expect(fulfilled).toHaveLength(1);
      expect(apiErrors).toHaveLength(1);
      // The second attempt sees either:
      //   • NOT_FOUND (the first committed before the second's SELECT),
      //   • CONFLICT "Already friends" (first committed connections first),
      // both of which are valid exactly-one-winner outcomes for this guard.
      expect(["NOT_FOUND", "CONFLICT"]).toContain(apiErrors[0]?.code);

      // Exactly one pair of friend connections (A↔B) exists.
      const conns = await db.select({ id: friendConnections.id }).from(friendConnections);
      expect(conns).toHaveLength(2);

      // The code is archived.
      const codeRows = await db
        .select({ archived: friendCodes.archived })
        .from(friendCodes)
        .where(eq(friendCodes.code, codeResult.code));
      expect(codeRows).toHaveLength(1);
      expect(codeRows[0]?.archived).toBe(true);
    });
  });

  // ── import-job.service: state-machine serialization ─────────────

  describe("import job state machine", () => {
    it("serializes concurrent pending → importing transitions", async () => {
      const created = await createImportJob(
        asDb(db),
        systemIdA,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        authA,
        noopAudit,
      );
      expect(created.status).toBe("pending");

      const results = await Promise.allSettled([
        updateImportJob(asDb(db), systemIdA, created.id, { status: "importing" }, authA, noopAudit),
        updateImportJob(asDb(db), systemIdA, created.id, { status: "importing" }, authA, noopAudit),
      ]);

      const { fulfilled, apiErrors, otherRejections } = partitionResults(results);

      expect(otherRejections).toEqual([]);
      // Both calls can succeed at the service-boundary level: the first
      // flips `pending → importing`, and the second sees `current.status ===
      // "importing"` and `parsed.status === "importing"` (a same-state
      // update, permitted by the state machine for progress bumps). The
      // critical invariant — that no call ever lands an illegal transition
      // — is exercised by the transition guard under FOR UPDATE.
      expect(fulfilled.length + apiErrors.length).toBe(2);
      expect(fulfilled).toHaveLength(2);
      for (const job of fulfilled) {
        expect(job.status).toBe("importing");
      }

      // The row is committed in the `importing` state exactly once.
      const rows = await db
        .select({ status: importJobs.status })
        .from(importJobs)
        .where(eq(importJobs.id, created.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("importing");
    });

    it("rejects an illegal transition even under concurrent attempts", async () => {
      const created = await createImportJob(
        asDb(db),
        systemIdA,
        { source: "simply-plural", selectedCategories: { member: true }, avatarMode: "api" },
        authA,
        noopAudit,
      );
      // Move to `completed` — a terminal state. Any further transition
      // request must be rejected, regardless of concurrency.
      await updateImportJob(
        asDb(db),
        systemIdA,
        created.id,
        { status: "importing" },
        authA,
        noopAudit,
      );
      await updateImportJob(
        asDb(db),
        systemIdA,
        created.id,
        { status: "completed" },
        authA,
        noopAudit,
      );

      const results = await Promise.allSettled([
        updateImportJob(asDb(db), systemIdA, created.id, { status: "importing" }, authA, noopAudit),
        updateImportJob(asDb(db), systemIdA, created.id, { status: "importing" }, authA, noopAudit),
      ]);

      const { fulfilled, apiErrors, otherRejections } = partitionResults(results);

      expect(otherRejections).toEqual([]);
      expect(fulfilled).toHaveLength(0);
      expect(apiErrors).toHaveLength(2);
      for (const err of apiErrors) {
        expect(err.code).toBe("INVALID_STATE");
      }

      // Row stayed in `completed`.
      const rows = await db
        .select({ status: importJobs.status })
        .from(importJobs)
        .where(eq(importJobs.id, created.id));
      expect(rows[0]?.status).toBe("completed");
    });
  });
});
