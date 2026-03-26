import { expect, test } from "../../fixtures/auth.fixture.js";
import { decryptFromApi, encryptForApi, ensureCryptoReady } from "../../fixtures/crypto.fixture.js";
import { createPoll, getSystemId } from "../../fixtures/entity-helpers.js";

interface PollResponse {
  id: string;
  systemId: string;
  kind: string;
  status: string;
  allowMultipleVotes: boolean;
  maxVotesPerMember: number;
  allowAbstain: boolean;
  allowVeto: boolean;
  encryptedData: string;
  version: number;
  archived: boolean;
  archivedAt: number | null;
  closedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface PollListResponse {
  items: PollResponse[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number | null;
}

const POLL_DATA = { title: "E2E Lifecycle Poll", description: null, options: [] };
const UPDATED_POLL_DATA = {
  title: "E2E Updated Poll",
  description: "Updated description",
  options: [],
};

test.describe("Polls CRUD", () => {
  test.beforeAll(async () => {
    await ensureCryptoReady();
  });

  test("poll lifecycle: create, get, list, update, close, archive, restore, delete", async ({
    request,
    authHeaders,
  }) => {
    const systemId = await getSystemId(request, authHeaders);
    const pollsUrl = `/v1/systems/${systemId}/polls`;
    let pollId: string;
    let pollVersion: number;

    await test.step("create poll", async () => {
      const res = await request.post(pollsUrl, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(POLL_DATA),
          kind: "standard",
          allowMultipleVotes: false,
          maxVotesPerMember: 1,
          allowAbstain: false,
          allowVeto: false,
        },
      });
      expect(res.status()).toBe(201);
      const body = (await res.json()) as PollResponse;
      expect(body.id).toMatch(/^poll_/);
      expect(body.status).toBe("open");
      expect(body.version).toBe(1);
      pollId = body.id;
      pollVersion = body.version;
    });

    await test.step("get and verify encryption round-trip", async () => {
      const res = await request.get(`${pollsUrl}/${pollId}`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as PollResponse;
      expect(body.id).toBe(pollId);
      const decrypted = decryptFromApi(body.encryptedData);
      expect(decrypted).toEqual(POLL_DATA);
    });

    await test.step("list includes created poll", async () => {
      const res = await request.get(pollsUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as PollListResponse;
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("hasMore");
      expect(body.items.some((item) => item.id === pollId)).toBe(true);
    });

    await test.step("update poll", async () => {
      const res = await request.put(`${pollsUrl}/${pollId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_POLL_DATA),
          version: pollVersion,
        },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as PollResponse;
      expect(body.version).toBe(pollVersion + 1);
      pollVersion = body.version;
    });

    await test.step("close poll", async () => {
      const res = await request.post(`${pollsUrl}/${pollId}/close`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as PollResponse;
      expect(body.status).toBe("closed");
      expect(body.closedAt).not.toBeNull();
      pollVersion = body.version;
    });

    await test.step("update closed poll returns 409", async () => {
      const res = await request.put(`${pollsUrl}/${pollId}`, {
        headers: authHeaders,
        data: {
          encryptedData: encryptForApi(UPDATED_POLL_DATA),
          version: pollVersion,
        },
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect((body as { error: { code: string } }).error.code).toBe("POLL_CLOSED");
    });

    await test.step("archive poll", async () => {
      const res = await request.post(`${pollsUrl}/${pollId}/archive`, { headers: authHeaders });
      expect(res.status()).toBe(204);
    });

    await test.step("archived not in default list", async () => {
      const res = await request.get(pollsUrl, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as PollListResponse;
      expect(body.items.every((item) => item.id !== pollId)).toBe(true);
    });

    await test.step("archived in list with includeArchived=true", async () => {
      const res = await request.get(`${pollsUrl}?includeArchived=true`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as PollListResponse;
      expect(body.items.some((item) => item.id === pollId)).toBe(true);
    });

    await test.step("restore poll", async () => {
      const res = await request.post(`${pollsUrl}/${pollId}/restore`, { headers: authHeaders });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as PollResponse;
      expect(body.archived).toBe(false);
      pollVersion = body.version;
    });

    await test.step("delete poll (no votes)", async () => {
      const res = await request.delete(`${pollsUrl}/${pollId}`, { headers: authHeaders });
      expect(res.status()).toBe(204);
    });

    await test.step("deleted poll returns 404", async () => {
      const res = await request.get(`${pollsUrl}/${pollId}`, { headers: authHeaders });
      expect(res.status()).toBe(404);
    });
  });

  test("filter polls by status", async ({ request, authHeaders }) => {
    const systemId = await getSystemId(request, authHeaders);
    const pollsUrl = `/v1/systems/${systemId}/polls`;

    // Create a poll and close it
    const closedPoll = await createPoll(request, authHeaders, systemId, { title: "Closed Poll" });
    await request.post(`${pollsUrl}/${closedPoll.id}/close`, { headers: authHeaders });

    // Create an open poll
    const openPoll = await createPoll(request, authHeaders, systemId, { title: "Open Poll" });

    // Filter by open status
    const openRes = await request.get(`${pollsUrl}?status=open`, { headers: authHeaders });
    expect(openRes.status()).toBe(200);
    const openBody = (await openRes.json()) as PollListResponse;
    expect(openBody.items.some((item) => item.id === openPoll.id)).toBe(true);
    expect(openBody.items.every((item) => item.id !== closedPoll.id)).toBe(true);

    // Filter by closed status
    const closedRes = await request.get(`${pollsUrl}?status=closed`, { headers: authHeaders });
    expect(closedRes.status()).toBe(200);
    const closedBody = (await closedRes.json()) as PollListResponse;
    expect(closedBody.items.some((item) => item.id === closedPoll.id)).toBe(true);
    expect(closedBody.items.every((item) => item.id !== openPoll.id)).toBe(true);
  });

  test("cross-system access returns 404", async ({ request, authHeaders }) => {
    const res = await request.get("/v1/systems/sys_00000000-0000-0000-0000-000000000000/polls", {
      headers: authHeaders,
    });
    expect(res.status()).toBe(404);
  });
});
