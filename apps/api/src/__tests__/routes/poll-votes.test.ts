import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mockAuditWriterFactory,
  mockAuthFactory,
  mockDbFactory,
  mockRateLimitFactory,
} from "../helpers/common-route-mocks.js";
import { MOCK_AUTH, createRouteApp, putJSON } from "../helpers/route-test-setup.js";

import type { ApiErrorResponse, MemberId } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────

vi.mock("../../services/poll-vote.service.js", () => ({
  castVote: vi.fn(),
  listVotes: vi.fn(),
  parsePollVoteQuery: vi.fn().mockReturnValue({ includeArchived: false }),
  updatePollVote: vi.fn(),
  deletePollVote: vi.fn(),
  getPollResults: vi.fn(),
}));

vi.mock("../../lib/audit-writer.js", () => mockAuditWriterFactory());

vi.mock("../../lib/db.js", () => mockDbFactory());

vi.mock("../../middleware/rate-limit.js", () => mockRateLimitFactory());

vi.mock("../../middleware/auth.js", () => mockAuthFactory());
// ── Imports after mocks ──────────────────────────────────────────

const { updatePollVote, deletePollVote, getPollResults } =
  await import("../../services/poll-vote.service.js");
const { systemRoutes } = await import("../../routes/systems/index.js");

// ── Helpers ──────────────────────────────────────────────────────

const SYS_ID = "sys_550e8400-e29b-41d4-a716-446655440000";
const POLL_ID = "poll_550e8400-e29b-41d4-a716-446655440001";
const VOTE_ID = "pv_550e8400-e29b-41d4-a716-446655440002";

const createApp = () => createRouteApp("/systems", systemRoutes);

const BASE_URL = `/systems/${SYS_ID}/polls/${POLL_ID}/votes`;
const VOTE_URL = `${BASE_URL}/${VOTE_ID}`;
const RESULTS_URL = `/systems/${SYS_ID}/polls/${POLL_ID}/results`;

const MOCK_VOTE = {
  id: VOTE_ID as never,
  pollId: POLL_ID as never,
  optionId: "opt_550e8400-e29b-41d4-a716-446655440003" as never,
  voter: { entityType: "member" as const, entityId: "mem_test" as MemberId },
  isVeto: false,
  votedAt: 1000 as never,
  encryptedData: "dGVzdA==",
  archived: false,
  archivedAt: null,
  createdAt: 1000 as never,
};

const VALID_UPDATE_BODY = {
  optionId: "opt_550e8400-e29b-41d4-a716-446655440003",
  encryptedData: "dGVzdA==",
};

const MOCK_RESULTS = {
  pollId: POLL_ID as never,
  totalVotes: 5,
  vetoCount: 1,
  optionCounts: [
    { optionId: "opt_550e8400-e29b-41d4-a716-446655440003", count: 3 },
    { optionId: null, count: 2 },
  ] as const,
};

// ── Tests: PUT /:pollId/votes/:voteId ───────────────────────────

describe("PUT /systems/:id/polls/:pollId/votes/:voteId", () => {
  beforeEach(() => vi.mocked(updatePollVote).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 on success", async () => {
    vi.mocked(updatePollVote).mockResolvedValueOnce(MOCK_VOTE);
    const app = createApp();
    const res = await putJSON(app, VOTE_URL, VALID_UPDATE_BODY);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { id: string } };
    expect(body.data.id).toBe(VOTE_ID);
  });

  it("forwards systemId, pollId, voteId, body, auth to service", async () => {
    vi.mocked(updatePollVote).mockResolvedValueOnce(MOCK_VOTE);
    const app = createApp();
    await putJSON(app, VOTE_URL, VALID_UPDATE_BODY);
    expect(vi.mocked(updatePollVote)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      POLL_ID,
      VOTE_ID,
      VALID_UPDATE_BODY,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid voteId format", async () => {
    const app = createApp();
    const res = await putJSON(app, `${BASE_URL}/bad-id`, VALID_UPDATE_BODY);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid pollId format", async () => {
    const app = createApp();
    const res = await putJSON(
      app,
      `/systems/${SYS_ID}/polls/bad-id/votes/${VOTE_ID}`,
      VALID_UPDATE_BODY,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(updatePollVote).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll vote not found"),
    );
    const app = createApp();
    const res = await putJSON(app, VOTE_URL, VALID_UPDATE_BODY);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(updatePollVote).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    const res = await putJSON(app, VOTE_URL, VALID_UPDATE_BODY);
    expect(res.status).toBe(500);
  });
});

// ── Tests: DELETE /:pollId/votes/:voteId ────────────────────────

describe("DELETE /systems/:id/polls/:pollId/votes/:voteId", () => {
  beforeEach(() => vi.mocked(deletePollVote).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 204 on success", async () => {
    vi.mocked(deletePollVote).mockResolvedValueOnce(undefined);
    const app = createApp();
    const res = await app.request(VOTE_URL, { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("forwards systemId, pollId, voteId, auth to service", async () => {
    vi.mocked(deletePollVote).mockResolvedValueOnce(undefined);
    const app = createApp();
    await app.request(VOTE_URL, { method: "DELETE" });
    expect(vi.mocked(deletePollVote)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      POLL_ID,
      VOTE_ID,
      MOCK_AUTH,
      expect.any(Function),
    );
  });

  it("returns 400 for invalid voteId format", async () => {
    const app = createApp();
    const res = await app.request(`${BASE_URL}/bad-id`, { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(deletePollVote).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll vote not found"),
    );
    const app = createApp();
    const res = await app.request(VOTE_URL, { method: "DELETE" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(deletePollVote).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    const res = await app.request(VOTE_URL, { method: "DELETE" });
    expect(res.status).toBe(500);
  });
});

// ── Tests: GET /:pollId/results ─────────────────────────────────

describe("GET /systems/:id/polls/:pollId/results", () => {
  beforeEach(() => vi.mocked(getPollResults).mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("returns 200 with results", async () => {
    vi.mocked(getPollResults).mockResolvedValueOnce(MOCK_RESULTS);
    const app = createApp();
    const res = await app.request(RESULTS_URL);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { totalVotes: number } };
    expect(body.data.totalVotes).toBe(5);
  });

  it("forwards systemId, pollId, auth to service", async () => {
    vi.mocked(getPollResults).mockResolvedValueOnce(MOCK_RESULTS);
    const app = createApp();
    await app.request(RESULTS_URL);
    expect(vi.mocked(getPollResults)).toHaveBeenCalledWith(
      expect.anything(),
      SYS_ID,
      POLL_ID,
      MOCK_AUTH,
    );
  });

  it("returns 400 for invalid pollId format", async () => {
    const app = createApp();
    const res = await app.request(`/systems/${SYS_ID}/polls/bad-id/results`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when service throws NOT_FOUND", async () => {
    const { ApiHttpError } = await import("../../lib/api-error.js");
    vi.mocked(getPollResults).mockRejectedValueOnce(
      new ApiHttpError(404, "NOT_FOUND", "Poll not found"),
    );
    const app = createApp();
    const res = await app.request(RESULTS_URL);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(getPollResults).mockRejectedValueOnce(new Error("DB timeout"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();
    const res = await app.request(RESULTS_URL);
    expect(res.status).toBe(500);
  });
});
