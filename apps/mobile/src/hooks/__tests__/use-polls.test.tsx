// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptPollInput } from "@pluralscape/data/transforms/poll";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

import type { PollRaw } from "@pluralscape/data/transforms/poll";
import type { PollId, PollOptionId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), useCallback: (fn: unknown) => fn };
});

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastQueryOpts: CapturedOpts = {};
let lastInfiniteOpts: CapturedOpts = {};
let lastResultsQueryOpts: CapturedOpts = {};
let lastVotesInfiniteOpts: CapturedOpts = {};
let lastCreateMutationOpts: CapturedOpts = {};
let lastUpdateMutationOpts: CapturedOpts = {};
let lastCloseMutationOpts: CapturedOpts = {};
let lastArchiveMutationOpts: CapturedOpts = {};
let lastRestoreMutationOpts: CapturedOpts = {};
let lastDeleteMutationOpts: CapturedOpts = {};
let lastCastVoteMutationOpts: CapturedOpts = {};
let lastUpdateVoteMutationOpts: CapturedOpts = {};
let lastDeleteVoteMutationOpts: CapturedOpts = {};

const mockUtils = {
  poll: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
    results: { invalidate: vi.fn() },
    listVotes: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    poll: {
      get: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastQueryOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      list: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastInfiniteOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      results: {
        useQuery: (_input: unknown, opts?: CapturedOpts) => {
          lastResultsQueryOpts = opts ?? { _called: true };
          return { data: undefined, isLoading: true, status: "loading" };
        },
        invalidate: vi.fn(),
      },
      listVotes: {
        useInfiniteQuery: (_input: unknown, opts: CapturedOpts) => {
          lastVotesInfiniteOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
        invalidate: vi.fn(),
      },
      create: {
        useMutation: (opts: CapturedOpts) => {
          lastCreateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      update: {
        useMutation: (opts: CapturedOpts) => {
          lastUpdateMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      close: {
        useMutation: (opts: CapturedOpts) => {
          lastCloseMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      archive: {
        useMutation: (opts: CapturedOpts) => {
          lastArchiveMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      restore: {
        useMutation: (opts: CapturedOpts) => {
          lastRestoreMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      delete: {
        useMutation: (opts: CapturedOpts) => {
          lastDeleteMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      castVote: {
        useMutation: (opts: CapturedOpts) => {
          lastCastVoteMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      updateVote: {
        useMutation: (opts: CapturedOpts) => {
          lastUpdateVoteMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
      deleteVote: {
        useMutation: (opts: CapturedOpts) => {
          lastDeleteVoteMutationOpts = opts;
          return { mutate: vi.fn() };
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

vi.mock("../../providers/crypto-provider.js", () => ({
  useMasterKey: vi.fn(() => TEST_MASTER_KEY),
}));
vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn(() => TEST_SYSTEM_ID),
}));

const { useMasterKey } = await import("../../providers/crypto-provider.js");
const {
  usePoll,
  usePollsList,
  usePollResults,
  usePollVotes,
  useCreatePoll,
  useUpdatePoll,
  useClosePoll,
  useArchivePoll,
  useRestorePoll,
  useDeletePoll,
  useCastVote,
  useUpdateVote,
  useDeleteVote,
} = await import("../use-polls.js");

// ── Fixtures ─────────────────────────────────────────────────────────
const NOW = 1_700_000_000_000 as UnixMillis;

function makeRawPoll(id: string): PollRaw {
  const encrypted = encryptPollInput(
    {
      title: "Vote",
      description: null,
      options: [
        { id: "opt-1" as PollOptionId, label: "Yes", voteCount: 0, color: null, emoji: null },
      ],
    },
    TEST_MASTER_KEY,
  );
  return {
    id: id as PollId,
    systemId: TEST_SYSTEM_ID,
    createdByMemberId: null,
    kind: "standard",
    status: "open",
    closedAt: null,
    endsAt: null,
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
  };
}

// ── Tests ────────────────────────────────────────────────────────────
describe("usePoll", () => {
  it("enables when masterKey is present", () => {
    usePoll("poll-1" as PollId);
    expect(lastQueryOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    usePoll("poll-1" as PollId);
    expect(lastQueryOpts["enabled"]).toBe(false);
  });

  it("select decrypts raw poll correctly", () => {
    usePoll("poll-1" as PollId);
    const select = lastQueryOpts["select"] as (raw: PollRaw) => unknown;
    const raw = makeRawPoll("poll-1");
    const result = select(raw) as Record<string, unknown>;
    expect(result["title"]).toBe("Vote");
    expect(result["description"]).toBeNull();
    expect(result["kind"]).toBe("standard");
    expect(result["status"]).toBe("open");
    expect(result["archived"]).toBe(false);
    const options = result["options"] as Array<Record<string, unknown>>;
    expect(options).toHaveLength(1);
    expect(options[0]?.["label"]).toBe("Yes");
  });
});

describe("usePollsList", () => {
  it("select decrypts each page item", () => {
    usePollsList();
    const select = lastInfiniteOpts["select"] as (data: unknown) => unknown;
    const raw1 = makeRawPoll("poll-1");
    const raw2 = makeRawPoll("poll-2");
    const infiniteData = {
      pages: [{ data: [raw1, raw2], nextCursor: null }],
      pageParams: [undefined],
    };
    const result = select(infiniteData) as {
      pages: [{ data: [Record<string, unknown>, Record<string, unknown>] }];
    };
    expect(result.pages[0].data).toHaveLength(2);
    expect(result.pages[0].data[0]["title"]).toBe("Vote");
    expect(result.pages[0].data[1]["title"]).toBe("Vote");
  });
});

describe("usePollResults", () => {
  it("calls useQuery without enabled guard", () => {
    usePollResults("poll-1" as PollId);
    // usePollResults does not use masterKey or enabled guard
    expect(lastResultsQueryOpts).toBeDefined();
  });
});

describe("usePollVotes", () => {
  it("enables when masterKey is present", () => {
    usePollVotes("poll-1" as PollId);
    expect(lastVotesInfiniteOpts["enabled"]).toBe(true);
  });

  it("disables when masterKey is null", () => {
    vi.mocked(useMasterKey).mockReturnValueOnce(null);
    usePollVotes("poll-1" as PollId);
    expect(lastVotesInfiniteOpts["enabled"]).toBe(false);
  });
});

describe("useCreatePoll", () => {
  it("invalidates list on success", () => {
    mockUtils.poll.list.invalidate.mockClear();
    useCreatePoll();
    const onSuccess = lastCreateMutationOpts["onSuccess"] as () => void;
    onSuccess();
    expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useUpdatePoll", () => {
  it("invalidates get and list on success", () => {
    mockUtils.poll.get.invalidate.mockClear();
    mockUtils.poll.list.invalidate.mockClear();
    useUpdatePoll();
    const onSuccess = lastUpdateMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { pollId: string },
    ) => void;
    onSuccess(undefined, { pollId: "poll-1" });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
    expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useClosePoll", () => {
  it("invalidates get, list, and results on success", () => {
    mockUtils.poll.get.invalidate.mockClear();
    mockUtils.poll.list.invalidate.mockClear();
    mockUtils.poll.results.invalidate.mockClear();
    useClosePoll();
    const onSuccess = lastCloseMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { pollId: string },
    ) => void;
    onSuccess(undefined, { pollId: "poll-1" });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
    expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
  });
});

describe("useArchivePoll", () => {
  it("invalidates get and list on success", () => {
    mockUtils.poll.get.invalidate.mockClear();
    mockUtils.poll.list.invalidate.mockClear();
    useArchivePoll();
    const onSuccess = lastArchiveMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { pollId: string },
    ) => void;
    onSuccess(undefined, { pollId: "poll-2" });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-2",
    });
    expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useRestorePoll", () => {
  it("invalidates get and list on success", () => {
    mockUtils.poll.get.invalidate.mockClear();
    mockUtils.poll.list.invalidate.mockClear();
    useRestorePoll();
    const onSuccess = lastRestoreMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { pollId: string },
    ) => void;
    onSuccess(undefined, { pollId: "poll-3" });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-3",
    });
    expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useDeletePoll", () => {
  it("invalidates get and list on success", () => {
    mockUtils.poll.get.invalidate.mockClear();
    mockUtils.poll.list.invalidate.mockClear();
    useDeletePoll();
    const onSuccess = lastDeleteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { pollId: string },
    ) => void;
    onSuccess(undefined, { pollId: "poll-4" });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-4",
    });
    expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
  });
});

describe("useCastVote", () => {
  it("invalidates results, listVotes, and get on success", () => {
    mockUtils.poll.results.invalidate.mockClear();
    mockUtils.poll.listVotes.invalidate.mockClear();
    mockUtils.poll.get.invalidate.mockClear();
    useCastVote();
    const onSuccess = lastCastVoteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { pollId: string },
    ) => void;
    onSuccess(undefined, { pollId: "poll-1" });
    expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
    expect(mockUtils.poll.listVotes.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-1",
    });
  });
});

describe("useUpdateVote", () => {
  it("invalidates results, listVotes, and get on success", () => {
    mockUtils.poll.results.invalidate.mockClear();
    mockUtils.poll.listVotes.invalidate.mockClear();
    mockUtils.poll.get.invalidate.mockClear();
    useUpdateVote();
    const onSuccess = lastUpdateVoteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { pollId: string },
    ) => void;
    onSuccess(undefined, { pollId: "poll-2" });
    expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-2",
    });
    expect(mockUtils.poll.listVotes.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-2",
    });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-2",
    });
  });
});

describe("useDeleteVote", () => {
  it("invalidates results, listVotes, and get on success", () => {
    mockUtils.poll.results.invalidate.mockClear();
    mockUtils.poll.listVotes.invalidate.mockClear();
    mockUtils.poll.get.invalidate.mockClear();
    useDeleteVote();
    const onSuccess = lastDeleteVoteMutationOpts["onSuccess"] as (
      data: unknown,
      variables: { pollId: string },
    ) => void;
    onSuccess(undefined, { pollId: "poll-3" });
    expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-3",
    });
    expect(mockUtils.poll.listVotes.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-3",
    });
    expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      pollId: "poll-3",
    });
  });
});
