/**
 * Proves row-level lock contention at the real Postgres (NOT PGlite). Each
 * concurrent HTTP request acquires its own PG connection from the API's
 * connection pool; the second transaction blocks on the first's FOR UPDATE
 * row lock at the DB. `pg_stat_activity.wait_event_type = 'Lock'` with
 * `wait_event = 'transactionid'` is the empirical proof — without it, we
 * cannot distinguish DB contention from event-loop serialization.
 *
 * The PGlite-backed integration spec
 * `apps/api/src/__tests__/integration/concurrent-guard-semantics.integration.test.ts`
 * covers the guard-logic invariants (exactly-one-winner, state-machine
 * rejection). This spec covers the lock-contention primitive they depend on.
 */
import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createPoll, getSystemId } from "../../fixtures/entity-helpers.js";
import {
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_NOT_FOUND,
  HTTP_OK,
  asAuthHeaders,
} from "../../fixtures/http.constants.js";
import { probeLockWaits } from "../../helpers/pg-probe.js";
import { registerAccount } from "../../helpers/register.js";

/** Probe window — wide enough that at least one race observation lands. */
const PROBE_DURATION_MS = 3_000;

/**
 * Connection-pool exhaustion statuses that are acceptable in the poll-vote
 * race when a slow CI runner drops a connection under 8-way concurrency. We
 * only reject a second 201 — the exactly-one-winner invariant.
 */
const HTTP_INTERNAL_SERVER_ERROR = 500;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * Fan-out for the vote race. Firing N > 2 concurrent votes on the same voter
 * saturates the FOR UPDATE row lock on `polls` so at least a handful of
 * transactions overlap during any 5ms probe tick, even though each
 * transaction itself only runs SELECT + COUNT + INSERT.
 */
const CONCURRENT_VOTE_ATTEMPTS = 8;

interface FriendCodeResponse {
  readonly data: {
    readonly code: string;
  };
}

function requireE2eDatabaseUrl(): string {
  const url = process.env["E2E_DATABASE_URL"];
  if (url === undefined || url === "") {
    throw new Error(
      "E2E_DATABASE_URL is not set. global-setup.ts must export it before tests run.",
    );
  }
  return url;
}

test.describe("Row-lock contention (real Postgres)", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("poll-vote: two concurrent votes — exactly one succeeds, probe sees Lock wait", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const poll = await createPoll(request, authHeaders, systemId, { maxVotesPerMember: 1 });
    const voterEntityId = `mem_${crypto.randomUUID()}`;
    const optionA = `po_${crypto.randomUUID()}`;
    const optionB = `po_${crypto.randomUUID()}`;
    const votesUrl = `/v1/systems/${systemId}/polls/${poll.id}/votes`;

    // Kick off the probe BEFORE firing the requests so it's already polling
    // when the contending transactions open.
    const probePromise = probeLockWaits({
      connectionString: requireE2eDatabaseUrl(),
      durationMs: PROBE_DURATION_MS,
    });

    // Fan out N concurrent votes on the same voter so at least a handful of
    // transactions overlap on the polls-row FOR UPDATE lock during any probe
    // tick. Each individual transaction is tiny (SELECT + COUNT + INSERT),
    // so a 2-request race can complete between probe polls.
    const optionIds = [
      optionA,
      optionB,
      ...Array.from({ length: CONCURRENT_VOTE_ATTEMPTS - 2 }, () => `po_${crypto.randomUUID()}`),
    ];
    const responses = await Promise.all(
      optionIds.map((optionId) =>
        request.post(votesUrl, {
          headers: authHeaders,
          data: {
            voter: { entityType: "member", entityId: voterEntityId },
            optionId,
            isVeto: false,
            encryptedData: encryptForApi({ comment: null }),
          },
        }),
      ),
    );

    const waits = await probePromise;

    // Exactly one winner; every other request must have failed. Accept 409
    // (TOO_MANY_VOTES — the happy failure) OR 500/503 (connection-pool
    // exhaustion under 8-way concurrency on a slow CI runner competing with
    // the pg_stat_activity probe). What we MUST NOT see is a second 201.
    const statuses = responses.map((r) => r.status()).sort((a, b) => a - b);
    const winners = statuses.filter((s) => s === HTTP_CREATED);
    const loserStatuses = statuses.filter((s) => s !== HTTP_CREATED);
    expect(winners).toHaveLength(1);
    for (const s of loserStatuses) {
      expect([HTTP_CONFLICT, HTTP_INTERNAL_SERVER_ERROR, HTTP_SERVICE_UNAVAILABLE]).toContain(s);
    }

    // When we do get a 409, confirm the error code — when every loser is a
    // 500/503 connection drop, there is no 409 body to inspect.
    const [firstConflict] = responses.filter((r) => r.status() === HTTP_CONFLICT);
    if (firstConflict) {
      const loserBody = (await firstConflict.json()) as { error: { code: string } };
      expect(loserBody.error.code).toBe("TOO_MANY_VOTES");
    }

    // At least one backend sat in wait_event_type='Lock', wait_event='transactionid'
    // — the smoking gun that the second transaction waited on the first's
    // row lock at the DB, not at the event loop.
    const transactionIdWaits = waits.filter((w) => w.waitEvent === "transactionid");
    expect(transactionIdWaits.length).toBeGreaterThanOrEqual(1);
  });

  test("friend-code: two concurrent redeems — exactly one succeeds, other is rejected", async ({
    request,
  }) => {
    // Account A owns the code, accounts B1 and B2 both try to redeem it. We
    // use two distinct redeeming accounts so both requests can open full
    // transactions against the live API (the self-redeem guard would short-
    // circuit one attempt if we reused the same account).
    const acctA = await registerAccount(request, { emailPrefix: "e2e-lock-fc-a" });
    const headersA = asAuthHeaders({ Authorization: `Bearer ${acctA.sessionToken}` });

    const acctB1 = await registerAccount(request, { emailPrefix: "e2e-lock-fc-b1" });
    const headersB1 = asAuthHeaders({ Authorization: `Bearer ${acctB1.sessionToken}` });

    const acctB2 = await registerAccount(request, { emailPrefix: "e2e-lock-fc-b2" });
    const headersB2 = asAuthHeaders({ Authorization: `Bearer ${acctB2.sessionToken}` });

    const codeRes = await request.post("/v1/account/friend-codes", { headers: headersA });
    expect(codeRes.status()).toBe(HTTP_CREATED);
    const { data: code } = (await codeRes.json()) as FriendCodeResponse;

    const [res1, res2] = await Promise.all([
      request.post("/v1/account/friend-codes/redeem", {
        headers: headersB1,
        data: { code: code.code },
      }),
      request.post("/v1/account/friend-codes/redeem", {
        headers: headersB2,
        data: { code: code.code },
      }),
    ]);

    const statuses = [res1.status(), res2.status()].sort((a, b) => a - b);
    // First redeem wins (201), second sees the code archived (404) or a
    // conflict (409) — both are valid exactly-one-winner outcomes.
    expect(statuses[0]).toBe(HTTP_CREATED);
    expect([HTTP_NOT_FOUND, HTTP_CONFLICT]).toContain(statuses[1]);

    // Partial-success guard: confirm exactly ONE friend edge was created for
    // account A even though we fired two concurrent redeems. A race bug where
    // both inserts succeeded would show length === 2.
    const friendsRes = await request.get("/v1/account/friends", { headers: headersA });
    expect(friendsRes.ok()).toBe(true);
    const friendsBody = (await friendsRes.json()) as { data: readonly unknown[] };
    expect(friendsBody.data).toHaveLength(1);
  });

  test("import-job: concurrent illegal transitions from terminal state both rejected (state-machine guard, not lock)", async ({
    request,
    authHeaders,
  }) => {
    // Note: this test proves the state-machine guard rejects illegal transitions
    // under concurrency. It does NOT exercise row-lock contention — `completed`
    // is terminal so both transactions fast-fail before touching the lock. Kept
    // in this file for thematic grouping with the other exactly-one-outcome
    // invariants; the lock-contention proof lives in the poll-vote test above.
    const systemId = await getSystemId(request, authHeaders);
    const importJobsUrl = `/v1/systems/${systemId}/import-jobs`;

    const createRes = await request.post(importJobsUrl, {
      headers: authHeaders,
      data: {
        source: "simply-plural",
        selectedCategories: { member: true },
        avatarMode: "skip",
      },
    });
    expect(createRes.status()).toBe(HTTP_CREATED);
    const { data: job } = (await createRes.json()) as { data: { id: string } };

    // Drive pending → validating → importing → completed
    for (const status of ["validating", "importing", "completed"] as const) {
      const patchRes = await request.patch(`${importJobsUrl}/${job.id}`, {
        headers: authHeaders,
        data: { status },
      });
      expect(patchRes.status()).toBe(HTTP_OK);
    }

    // Two concurrent `completed → importing` attempts. Neither may succeed
    // (completed is terminal), and the row must stay in `completed`.
    const [resA, resB] = await Promise.all([
      request.patch(`${importJobsUrl}/${job.id}`, {
        headers: authHeaders,
        data: { status: "importing" },
      }),
      request.patch(`${importJobsUrl}/${job.id}`, {
        headers: authHeaders,
        data: { status: "importing" },
      }),
    ]);

    for (const res of [resA, resB]) {
      expect(res.status()).toBe(HTTP_CONFLICT);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("INVALID_STATE");
    }

    const getRes = await request.get(`${importJobsUrl}/${job.id}`, { headers: authHeaders });
    expect(getRes.status()).toBe(HTTP_OK);
    const { data: final } = (await getRes.json()) as { data: { status: string } };
    expect(final.status).toBe("completed");
  });
});
