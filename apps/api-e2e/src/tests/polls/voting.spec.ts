import { expect, test } from "../../fixtures/auth.fixture.js";
import { encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createPoll, getSystemId } from "../../fixtures/entity-helpers.js";

interface VoteResponse {
  id: string;
  pollId: string;
  voter: { entityType: string; entityId: string };
  optionId: string | null;
  isVeto: boolean;
  encryptedData: string;
  createdAt: number;
}

interface VoteListResponse {
  items: VoteResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number | null;
}

test.describe("Poll Voting", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("vote lifecycle: cast, list, reject duplicate", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    let pollId: string;
    let voteId: string;

    await test.step("create poll", async () => {
      const poll = await createPoll(request, authHeaders, systemId, {
        maxVotesPerMember: 1,
      });
      pollId = poll.id;
    });

    await test.step("cast vote", async () => {
      const res = await request.post(`/v1/systems/${systemId}/polls/${pollId}/votes`, {
        headers: authHeaders,
        data: {
          voter: { entityType: "member", entityId: "mem_voter-1" },
          optionId: "po_option-1",
          isVeto: false,
          encryptedData: encryptForApi({ comment: null }),
        },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as VoteResponse;
      expect(body.id).toMatch(/^pv_/);
      expect(body.pollId).toBe(pollId);
      expect(body.voter.entityType).toBe("member");
      expect(body.voter.entityId).toBe("mem_voter-1");
      voteId = body.id;
    });

    await test.step("list votes", async () => {
      const res = await request.get(`/v1/systems/${systemId}/polls/${pollId}/votes`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as VoteListResponse;
      expect(body).toHaveProperty("items");
      expect(body.items.some((item) => item.id === voteId)).toBe(true);
    });

    await test.step("reject duplicate from same voter", async () => {
      const res = await request.post(`/v1/systems/${systemId}/polls/${pollId}/votes`, {
        headers: authHeaders,
        data: {
          voter: { entityType: "member", entityId: "mem_voter-1" },
          optionId: "po_option-2",
          isVeto: false,
          encryptedData: encryptForApi({ comment: null }),
        },
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect((body as { error: { code: string } }).error.code).toBe("TOO_MANY_VOTES");
    });

    await test.step("different voter can vote", async () => {
      const res = await request.post(`/v1/systems/${systemId}/polls/${pollId}/votes`, {
        headers: authHeaders,
        data: {
          voter: { entityType: "member", entityId: "mem_voter-2" },
          optionId: "po_option-1",
          isVeto: false,
          encryptedData: encryptForApi({ comment: null }),
        },
      });
      expect(res.status()).toBe(201);
    });
  });

  test("multi-vote enforcement", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const poll = await createPoll(request, authHeaders, systemId, {
      allowMultipleVotes: true,
      maxVotesPerMember: 3,
    });
    const votesUrl = `/v1/systems/${systemId}/polls/${poll.id}/votes`;

    // Cast 3 votes with same voter, different optionIds — all succeed
    for (let i = 1; i <= 3; i++) {
      const res = await request.post(votesUrl, {
        headers: authHeaders,
        data: {
          voter: { entityType: "member", entityId: "mem_multi-voter" },
          optionId: `po_option-${String(i)}`,
          isVeto: false,
          encryptedData: encryptForApi({ comment: null }),
        },
      });
      expect(res.status()).toBe(201);
    }

    // 4th vote rejected
    const res = await request.post(votesUrl, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: "mem_multi-voter" },
        optionId: "po_option-4",
        isVeto: false,
        encryptedData: encryptForApi({ comment: null }),
      },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect((body as { error: { code: string } }).error.code).toBe("TOO_MANY_VOTES");
  });

  test("abstain enforcement", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    // Poll with allowAbstain=true — abstain vote succeeds
    const allowedPoll = await createPoll(request, authHeaders, systemId, {
      allowAbstain: true,
    });
    const allowedRes = await request.post(`/v1/systems/${systemId}/polls/${allowedPoll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: "mem_abstain-1" },
        optionId: null,
        isVeto: false,
        encryptedData: encryptForApi({ comment: null }),
      },
    });
    expect(allowedRes.status()).toBe(201);

    // Poll with allowAbstain=false — abstain vote rejected
    const disallowedPoll = await createPoll(request, authHeaders, systemId, {
      allowAbstain: false,
    });
    const disallowedRes = await request.post(
      `/v1/systems/${systemId}/polls/${disallowedPoll.id}/votes`,
      {
        headers: authHeaders,
        data: {
          voter: { entityType: "member", entityId: "mem_abstain-2" },
          optionId: null,
          isVeto: false,
          encryptedData: encryptForApi({ comment: null }),
        },
      },
    );
    expect(disallowedRes.status()).toBe(409);
    const body = await disallowedRes.json();
    expect((body as { error: { code: string } }).error.code).toBe("ABSTAIN_NOT_ALLOWED");
  });

  test("veto enforcement", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);

    // Poll with allowVeto=true — veto vote succeeds
    const allowedPoll = await createPoll(request, authHeaders, systemId, {
      allowVeto: true,
    });
    const allowedRes = await request.post(`/v1/systems/${systemId}/polls/${allowedPoll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: "mem_veto-1" },
        optionId: "po_option-1",
        isVeto: true,
        encryptedData: encryptForApi({ comment: null }),
      },
    });
    expect(allowedRes.status()).toBe(201);

    // Poll with allowVeto=false — veto vote rejected
    const disallowedPoll = await createPoll(request, authHeaders, systemId, {
      allowVeto: false,
    });
    const disallowedRes = await request.post(
      `/v1/systems/${systemId}/polls/${disallowedPoll.id}/votes`,
      {
        headers: authHeaders,
        data: {
          voter: { entityType: "member", entityId: "mem_veto-2" },
          optionId: "po_option-1",
          isVeto: true,
          encryptedData: encryptForApi({ comment: null }),
        },
      },
    );
    expect(disallowedRes.status()).toBe(409);
    const body = await disallowedRes.json();
    expect((body as { error: { code: string } }).error.code).toBe("VETO_NOT_ALLOWED");
  });

  test("vote on closed poll returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const poll = await createPoll(request, authHeaders, systemId);

    // Close the poll
    const closeRes = await request.post(`/v1/systems/${systemId}/polls/${poll.id}/close`, {
      headers: authHeaders,
    });
    expect(closeRes.status()).toBe(200);

    // Try to vote on closed poll
    const res = await request.post(`/v1/systems/${systemId}/polls/${poll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: "mem_late-voter" },
        optionId: "po_option-1",
        isVeto: false,
        encryptedData: encryptForApi({ comment: null }),
      },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect((body as { error: { code: string } }).error.code).toBe("POLL_CLOSED");
  });

  test("vote on expired poll returns 409 POLL_CLOSED", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const poll = await createPoll(request, authHeaders, systemId, {
      endsAt: Date.now() - 60_000,
    });

    const res = await request.post(`/v1/systems/${systemId}/polls/${poll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: "mem_expired-voter" },
        optionId: "po_option-1",
        isVeto: false,
        encryptedData: encryptForApi({ comment: null }),
      },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect((body as { error: { code: string } }).error.code).toBe("POLL_CLOSED");
  });

  test("delete poll with votes returns 409", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const poll = await createPoll(request, authHeaders, systemId);

    // Cast a vote
    const voteRes = await request.post(`/v1/systems/${systemId}/polls/${poll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: "mem_keeper" },
        optionId: "po_option-1",
        isVeto: false,
        encryptedData: encryptForApi({ comment: null }),
      },
    });
    expect(voteRes.status()).toBe(201);

    // Try to delete poll with votes
    const res = await request.delete(`/v1/systems/${systemId}/polls/${poll.id}`, {
      headers: authHeaders,
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect((body as { error: { code: string } }).error.code).toBe("HAS_DEPENDENTS");
  });
});
