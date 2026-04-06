import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
  mockScopeFactory,
  mockSystemOwnershipFactory,
} from "../../helpers/common-route-mocks.js";
import { createRouteApp, MOCK_AUTH, postJSON, putJSON } from "../../helpers/route-test-setup.js";

import type { PollVoteResult } from "../../../services/poll-vote.service.js";
import type { PollResult } from "../../../services/poll.service.js";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../../services/poll.service.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../services/poll.service.js")>();
  return {
    createPoll: vi.fn(),
    getPoll: vi.fn(),
    listPolls: vi.fn(),
    updatePoll: vi.fn(),
    deletePoll: vi.fn(),
    closePoll: vi.fn(),
    archivePoll: vi.fn(),
    restorePoll: vi.fn(),
    parsePollQuery: original.parsePollQuery,
  };
});

vi.mock("../../../services/poll-vote.service.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../services/poll-vote.service.js")>();
  return {
    castVote: vi.fn(),
    listVotes: vi.fn(),
    parsePollVoteQuery: original.parsePollVoteQuery,
  };
});

vi.mock("../../../lib/audit-writer.js", () => mockAuditWriterFactory());
vi.mock("../../../lib/db.js", () => mockDbFactory());
vi.mock("../../../lib/system-ownership.js", () => mockSystemOwnershipFactory());
vi.mock("../../../middleware/rate-limit.js", () => mockRateLimitFactory());
vi.mock("../../../middleware/auth.js", () => mockAuthFactory());

vi.mock("../../../middleware/scope.js", () => mockScopeFactory());

// ── Imports after mocks ──────────────────────────────────────────

const {
  createPoll,
  getPoll,
  listPolls,
  updatePoll,
  deletePoll,
  closePoll,
  archivePoll,
  restorePoll,
} = await import("../../../services/poll.service.js");
const { castVote, listVotes } = await import("../../../services/poll-vote.service.js");
const { ApiHttpError } = await import("../../../lib/api-error.js");
const { systemRoutes } = await import("../../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE = "/systems/sys_550e8400-e29b-41d4-a716-446655440000/polls";
const POLL_ID = "poll_550e8400-e29b-41d4-a716-446655440000";
const VOTE_ID = "pv_550e8400-e29b-41d4-a716-446655440000";

const MOCK_POLL: PollResult = {
  id: POLL_ID as never,
  systemId: MOCK_AUTH.systemId as never,
  createdByMemberId: null,
  kind: "standard",
  status: "open",
  closedAt: null,
  endsAt: null,
  allowMultipleVotes: false,
  maxVotesPerMember: 1,
  allowAbstain: false,
  allowVeto: false,
  encryptedData: "dGVzdA==",
  version: 1,
  createdAt: 1000 as never,
  updatedAt: 1000 as never,
  archived: false,
  archivedAt: null,
};

const MOCK_VOTE: PollVoteResult = {
  id: VOTE_ID as never,
  pollId: POLL_ID as never,
  optionId: null,
  voter: null,
  isVeto: false,
  votedAt: 1000 as never,
  encryptedData: "dGVzdA==",
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
};

// ── Tests ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(createPoll).mockReset();
  vi.mocked(getPoll).mockReset();
  vi.mocked(listPolls).mockReset();
  vi.mocked(updatePoll).mockReset();
  vi.mocked(deletePoll).mockReset();
  vi.mocked(closePoll).mockReset();
  vi.mocked(archivePoll).mockReset();
  vi.mocked(restorePoll).mockReset();
  vi.mocked(castVote).mockReset();
  vi.mocked(listVotes).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /systems/:id/polls (create)", () => {
  it("returns 201 with new poll on success", async () => {
    vi.mocked(createPoll).mockResolvedValueOnce(MOCK_POLL);

    const res = await postJSON(createApp(), BASE, {
      kind: "standard",
      encryptedData: "dGVzdA==",
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: false,
      allowVeto: false,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(POLL_ID);
  });

  it("forwards systemId, body, auth, and audit writer to service", async () => {
    vi.mocked(createPoll).mockResolvedValueOnce(MOCK_POLL);

    await postJSON(createApp(), BASE, {
      kind: "standard",
      encryptedData: "dGVzdA==",
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: false,
      allowVeto: false,
    });

    expect(vi.mocked(createPoll)).toHaveBeenCalledWith(
      expect.anything(),
      "sys_550e8400-e29b-41d4-a716-446655440000",
      expect.objectContaining({ kind: "standard", encryptedData: "dGVzdA==" }),
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(createPoll).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await postJSON(createApp(), BASE, {
      kind: "standard",
      encryptedData: "dGVzdA==",
      allowMultipleVotes: false,
      maxVotesPerMember: 1,
      allowAbstain: false,
      allowVeto: false,
    });

    expect(res.status).toBe(500);
  });
});

describe("GET /systems/:id/polls (list)", () => {
  it("returns 200 with paginated result", async () => {
    vi.mocked(listPolls).mockResolvedValueOnce({
      data: [MOCK_POLL],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });

    const res = await createApp().request(BASE);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

describe("GET /systems/:id/polls/:pollId", () => {
  it("returns 200 with poll", async () => {
    vi.mocked(getPoll).mockResolvedValueOnce(MOCK_POLL);

    const res = await createApp().request(`${BASE}/${POLL_ID}`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(POLL_ID);
  });

  it("returns 404 when poll not found", async () => {
    vi.mocked(getPoll).mockRejectedValueOnce(new ApiHttpError(404, "NOT_FOUND", "Poll not found"));

    const res = await createApp().request(`${BASE}/${POLL_ID}`);

    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected error", async () => {
    vi.mocked(getPoll).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const res = await createApp().request(`${BASE}/${POLL_ID}`);

    expect(res.status).toBe(500);
  });
});

describe("PUT /systems/:id/polls/:pollId", () => {
  it("returns 200 with updated poll", async () => {
    vi.mocked(updatePoll).mockResolvedValueOnce({ ...MOCK_POLL, version: 2 });

    const res = await putJSON(createApp(), `${BASE}/${POLL_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(200);
  });

  it("returns 409 on version conflict", async () => {
    vi.mocked(updatePoll).mockRejectedValueOnce(
      new ApiHttpError(409, "CONFLICT", "Version conflict"),
    );

    const res = await putJSON(createApp(), `${BASE}/${POLL_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(409);
  });

  it("returns 409 when poll is closed", async () => {
    vi.mocked(updatePoll).mockRejectedValueOnce(
      new ApiHttpError(409, "POLL_CLOSED", "Poll is closed"),
    );

    const res = await putJSON(createApp(), `${BASE}/${POLL_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(409);
  });

  it("returns 404 when poll not found", async () => {
    vi.mocked(updatePoll).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
    );

    const res = await putJSON(createApp(), `${BASE}/${POLL_ID}`, {
      encryptedData: "dGVzdA==",
      version: 1,
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /systems/:id/polls/:pollId", () => {
  it("returns 204 on success", async () => {
    vi.mocked(deletePoll).mockResolvedValueOnce(undefined);

    const res = await createApp().request(`${BASE}/${POLL_ID}`, { method: "DELETE" });

    expect(res.status).toBe(204);
  });

  it("returns 404 when poll not found", async () => {
    vi.mocked(deletePoll).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
    );

    const res = await createApp().request(`${BASE}/${POLL_ID}`, { method: "DELETE" });

    expect(res.status).toBe(404);
  });

  it("returns 409 when poll has dependents", async () => {
    vi.mocked(deletePoll).mockRejectedValueOnce(
      new ApiHttpError(409, "HAS_DEPENDENTS", "Poll has dependents", {
        dependents: [{ type: "pollVotes", count: 2 }],
      }),
    );

    const res = await createApp().request(`${BASE}/${POLL_ID}`, { method: "DELETE" });

    expect(res.status).toBe(409);
  });
});

describe("POST /systems/:id/polls/:pollId/close", () => {
  it("returns 200 with closed poll", async () => {
    vi.mocked(closePoll).mockResolvedValueOnce({ ...MOCK_POLL, status: "closed" });

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/close`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string } };
    expect(body.data.status).toBe("closed");
  });

  it("returns 409 when poll is already closed", async () => {
    vi.mocked(closePoll).mockRejectedValueOnce(
      new ApiHttpError(409, "POLL_CLOSED", "Poll is closed"),
    );

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/close`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when poll not found", async () => {
    vi.mocked(closePoll).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/close`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/polls/:pollId/archive", () => {
  it("returns 204 on success", async () => {
    vi.mocked(archivePoll).mockResolvedValueOnce(undefined);

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/archive`, {});

    expect(res.status).toBe(204);
  });

  it("returns 409 when already archived", async () => {
    vi.mocked(archivePoll).mockRejectedValueOnce(
      new ApiHttpError(409, "ALREADY_ARCHIVED", "Poll is already archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/archive`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when poll not found", async () => {
    vi.mocked(archivePoll).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/archive`, {});

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/polls/:pollId/restore", () => {
  it("returns 200 with restored poll", async () => {
    vi.mocked(restorePoll).mockResolvedValueOnce({
      ...MOCK_POLL,
      version: 3,
    });

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/restore`, {});

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { version: number } };
    expect(body.data.version).toBe(3);
  });

  it("returns 409 when not archived", async () => {
    vi.mocked(restorePoll).mockRejectedValueOnce(
      new ApiHttpError(409, "NOT_ARCHIVED", "Poll is not archived"),
    );

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/restore`, {});

    expect(res.status).toBe(409);
  });

  it("returns 404 when poll not found", async () => {
    vi.mocked(restorePoll).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
    );

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/restore`, {});

    expect(res.status).toBe(404);
  });
});

describe("GET /systems/:id/polls/:pollId/votes (list votes)", () => {
  it("returns 200 with paginated vote result", async () => {
    vi.mocked(listVotes).mockResolvedValueOnce({
      data: [MOCK_VOTE],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });

    const res = await createApp().request(`${BASE}/${POLL_ID}/votes`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  it("returns 404 when poll not found", async () => {
    vi.mocked(listVotes).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
    );

    const res = await createApp().request(`${BASE}/${POLL_ID}/votes`);

    expect(res.status).toBe(404);
  });
});

describe("POST /systems/:id/polls/:pollId/votes (cast vote)", () => {
  it("returns 201 with new vote on success", async () => {
    vi.mocked(castVote).mockResolvedValueOnce(MOCK_VOTE);

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/votes`, {
      encryptedData: "dGVzdA==",
      optionId: null,
      isVeto: false,
      voter: { entityType: "member", entityId: "mbr_test" },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(VOTE_ID);
  });

  it("returns 409 when poll is closed", async () => {
    vi.mocked(castVote).mockRejectedValueOnce(
      new ApiHttpError(409, "POLL_CLOSED", "Poll is closed"),
    );

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/votes`, {
      encryptedData: "dGVzdA==",
      optionId: null,
      isVeto: false,
      voter: { entityType: "member", entityId: "mbr_test" },
    });

    expect(res.status).toBe(409);
  });

  it("returns 409 when voter has too many votes", async () => {
    vi.mocked(castVote).mockRejectedValueOnce(
      new ApiHttpError(409, "TOO_MANY_VOTES", "Voter has reached the maximum number of votes"),
    );

    const res = await postJSON(createApp(), `${BASE}/${POLL_ID}/votes`, {
      encryptedData: "dGVzdA==",
      optionId: null,
      isVeto: false,
      voter: { entityType: "member", entityId: "mbr_test" },
    });

    expect(res.status).toBe(409);
  });
});
