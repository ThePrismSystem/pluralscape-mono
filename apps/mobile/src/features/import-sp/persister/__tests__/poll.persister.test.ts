import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { makeTestPersisterContext } from "../../__tests__/persister-test-helpers.js";
import { pollPersister } from "../poll.persister.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

const POLL_WITH_THREE_VOTES = {
  encrypted: {
    title: "Lunch?",
    description: null,
    options: [
      { id: "opt_a", label: "pizza", color: null },
      { id: "opt_b", label: "sushi", color: null },
    ],
  },
  kind: "standard" as const,
  createdByMemberId: null,
  allowMultipleVotes: false,
  maxVotesPerMember: 1,
  allowAbstain: true,
  allowVeto: true,
  endsAt: null,
  votes: [
    { optionId: "opt_a", memberId: "mem_1", isVeto: false, comment: null },
    { optionId: "opt_b", memberId: "mem_2", isVeto: false, comment: null },
    { optionId: "", memberId: null, isVeto: true, comment: "no thanks" },
  ],
};

describe("pollPersister", () => {
  it("creates the poll with config fields, then fans out one castVote per vote", async () => {
    const ctx = makeTestPersisterContext();
    const createFn = vi.mocked(ctx.api.poll.create);
    const castVote = vi.mocked(ctx.api.poll.castVote);

    const result = await pollPersister.create(ctx, POLL_WITH_THREE_VOTES);

    expect(createFn).toHaveBeenCalledTimes(1);
    expect(createFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        encryptedData: expect.any(String),
        kind: "standard",
        allowMultipleVotes: false,
        maxVotesPerMember: 1,
        allowAbstain: true,
        allowVeto: true,
      }),
    );
    expect(castVote).toHaveBeenCalledTimes(3);
    expect(result.pluralscapeEntityId).toBe("poll_1");
  });

  it("update fans out votes the same way", async () => {
    const ctx = makeTestPersisterContext();
    const updateFn = vi.mocked(ctx.api.poll.update);
    const castVote = vi.mocked(ctx.api.poll.castVote);

    await pollPersister.update(ctx, POLL_WITH_THREE_VOTES, "poll_existing");

    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn.mock.calls[0]?.[1]).toBe("poll_existing");
    expect(castVote).toHaveBeenCalledTimes(3);
  });

  it("rejects payloads missing votes", async () => {
    const ctx = makeTestPersisterContext();
    await expect(
      pollPersister.create(ctx, { encrypted: POLL_WITH_THREE_VOTES.encrypted, kind: "standard" }),
    ).rejects.toThrow(/invalid payload for poll/);
  });
});
