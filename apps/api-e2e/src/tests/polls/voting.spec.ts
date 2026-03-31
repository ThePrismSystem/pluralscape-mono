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
  data: VoteResponse[];
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
    const voter1 = `mem_${crypto.randomUUID()}`;
    const voter2 = `mem_${crypto.randomUUID()}`;
    const option1 = `po_${crypto.randomUUID()}`;
    const option2 = `po_${crypto.randomUUID()}`;
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
          voter: { entityType: "member", entityId: voter1 },
          optionId: option1,
          isVeto: false,
          encryptedData: encryptForApi({ comment: null }),
        },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as { data: VoteResponse };
      expect(body.data.id).toMatch(/^pv_/);
      expect(body.data.pollId).toBe(pollId);
      expect(body.data.voter.entityType).toBe("member");
      expect(body.data.voter.entityId).toBe(voter1);
      voteId = body.data.id;
    });

    await test.step("list votes", async () => {
      const res = await request.get(`/v1/systems/${systemId}/polls/${pollId}/votes`, {
        headers: authHeaders,
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as VoteListResponse;
      expect(body).toHaveProperty("data");
      expect(body.data.some((item) => item.id === voteId)).toBe(true);
    });

    await test.step("reject duplicate from same voter", async () => {
      const res = await request.post(`/v1/systems/${systemId}/polls/${pollId}/votes`, {
        headers: authHeaders,
        data: {
          voter: { entityType: "member", entityId: voter1 },
          optionId: option2,
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
          voter: { entityType: "member", entityId: voter2 },
          optionId: option1,
          isVeto: false,
          encryptedData: encryptForApi({ comment: null }),
        },
      });
      expect(res.status()).toBe(201);
    });
  });

  test("multi-vote enforcement", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const multiVoter = `mem_${crypto.randomUUID()}`;
    const optionIds = Array.from({ length: 4 }, () => `po_${crypto.randomUUID()}`);
    const poll = await createPoll(request, authHeaders, systemId, {
      allowMultipleVotes: true,
      maxVotesPerMember: 3,
    });
    const votesUrl = `/v1/systems/${systemId}/polls/${poll.id}/votes`;

    // Cast 3 votes with same voter, different optionIds — all succeed
    for (let i = 0; i < 3; i++) {
      const res = await request.post(votesUrl, {
        headers: authHeaders,
        data: {
          voter: { entityType: "member", entityId: multiVoter },
          optionId: optionIds[i],
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
        voter: { entityType: "member", entityId: multiVoter },
        optionId: optionIds[3],
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
    const abstainVoter1 = `mem_${crypto.randomUUID()}`;
    const abstainVoter2 = `mem_${crypto.randomUUID()}`;

    // Poll with allowAbstain=true — abstain vote succeeds
    const allowedPoll = await createPoll(request, authHeaders, systemId, {
      allowAbstain: true,
    });
    const allowedRes = await request.post(`/v1/systems/${systemId}/polls/${allowedPoll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: abstainVoter1 },
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
          voter: { entityType: "member", entityId: abstainVoter2 },
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
    const vetoVoter1 = `mem_${crypto.randomUUID()}`;
    const vetoVoter2 = `mem_${crypto.randomUUID()}`;
    const vetoOption1 = `po_${crypto.randomUUID()}`;
    const vetoOption2 = `po_${crypto.randomUUID()}`;

    // Poll with allowVeto=true — veto vote succeeds
    const allowedPoll = await createPoll(request, authHeaders, systemId, {
      allowVeto: true,
    });
    const allowedRes = await request.post(`/v1/systems/${systemId}/polls/${allowedPoll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: vetoVoter1 },
        optionId: vetoOption1,
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
          voter: { entityType: "member", entityId: vetoVoter2 },
          optionId: vetoOption2,
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
    const lateVoter = `mem_${crypto.randomUUID()}`;
    const lateOption = `po_${crypto.randomUUID()}`;
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
        voter: { entityType: "member", entityId: lateVoter },
        optionId: lateOption,
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
    const expiredVoter = `mem_${crypto.randomUUID()}`;
    const expiredOption = `po_${crypto.randomUUID()}`;
    const poll = await createPoll(request, authHeaders, systemId, {
      endsAt: Date.now() - 60_000,
    });

    const res = await request.post(`/v1/systems/${systemId}/polls/${poll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: expiredVoter },
        optionId: expiredOption,
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
    const keeperVoter = `mem_${crypto.randomUUID()}`;
    const keeperOption = `po_${crypto.randomUUID()}`;
    const poll = await createPoll(request, authHeaders, systemId);

    // Cast a vote
    const voteRes = await request.post(`/v1/systems/${systemId}/polls/${poll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: keeperVoter },
        optionId: keeperOption,
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

  test("update a vote", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const voter = `mem_${crypto.randomUUID()}`;
    const option1 = `po_${crypto.randomUUID()}`;
    const option2 = `po_${crypto.randomUUID()}`;
    const poll = await createPoll(request, authHeaders, systemId);

    const castRes = await request.post(`/v1/systems/${systemId}/polls/${poll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: voter },
        optionId: option1,
        isVeto: false,
        encryptedData: encryptForApi({ comment: null }),
      },
    });
    expect(castRes.status()).toBe(201);
    const voteId = ((await castRes.json()) as { data: { id: string } }).data.id;

    const updateRes = await request.put(
      `/v1/systems/${systemId}/polls/${poll.id}/votes/${voteId}`,
      {
        headers: authHeaders,
        data: {
          optionId: option2,
          isVeto: false,
          encryptedData: encryptForApi({ comment: null }),
        },
      },
    );
    expect(updateRes.ok()).toBe(true);
  });

  test("delete a vote", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const voter = `mem_${crypto.randomUUID()}`;
    const option = `po_${crypto.randomUUID()}`;
    const poll = await createPoll(request, authHeaders, systemId);

    const castRes = await request.post(`/v1/systems/${systemId}/polls/${poll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: voter },
        optionId: option,
        isVeto: false,
        encryptedData: encryptForApi({ comment: null }),
      },
    });
    const voteId = ((await castRes.json()) as { data: { id: string } }).data.id;

    const deleteRes = await request.delete(
      `/v1/systems/${systemId}/polls/${poll.id}/votes/${voteId}`,
      { headers: authHeaders },
    );
    expect(deleteRes.status()).toBe(204);
  });

  test("get poll results", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const poll = await createPoll(request, authHeaders, systemId, { allowVeto: true });

    const voter1 = `mem_${crypto.randomUUID()}`;
    const option = `po_${crypto.randomUUID()}`;
    await request.post(`/v1/systems/${systemId}/polls/${poll.id}/votes`, {
      headers: authHeaders,
      data: {
        voter: { entityType: "member", entityId: voter1 },
        optionId: option,
        isVeto: false,
        encryptedData: encryptForApi({ comment: null }),
      },
    });

    const resultsRes = await request.get(`/v1/systems/${systemId}/polls/${poll.id}/results`, {
      headers: authHeaders,
    });
    expect(resultsRes.ok()).toBe(true);
    const resultsBody = await resultsRes.json();
    expect(resultsBody).toHaveProperty("data");
  });
});
