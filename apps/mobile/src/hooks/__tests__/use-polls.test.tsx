// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { encryptPollInput, encryptPollVoteInput } from "@pluralscape/data/transforms/poll";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderHookWithProviders,
  TEST_MASTER_KEY,
  TEST_SYSTEM_ID,
} from "./helpers/render-hook-with-providers.js";

import type { PollRaw, PollVoteRaw } from "@pluralscape/data/transforms/poll";
import type { PollId, PollOptionId, PollVoteId, UnixMillis } from "@pluralscape/types";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  poll: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
    results: { invalidate: vi.fn() },
    listVotes: { invalidate: vi.fn() },
  },
};

// ── tRPC mock backed by real React Query ─────────────────────────────
vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      poll: {
        get: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["poll.get", input],
              queryFn: () => Promise.resolve(fixtures.get("poll.get")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        list: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["poll.list", input],
              queryFn: () => Promise.resolve(fixtures.get("poll.list")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
              getNextPageParam: opts.getNextPageParam as (lp: unknown) => unknown,
              initialPageParam: undefined,
            }),
        },
        results: {
          useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useQuery({
              queryKey: ["poll.results", input],
              queryFn: () => Promise.resolve(fixtures.get("poll.results")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
            }),
        },
        listVotes: {
          useInfiniteQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
            rq.useInfiniteQuery({
              queryKey: ["poll.listVotes", input],
              queryFn: () => Promise.resolve(fixtures.get("poll.listVotes")),
              enabled: opts.enabled as boolean | undefined,
              select: opts.select as ((d: unknown) => unknown) | undefined,
              getNextPageParam: opts.getNextPageParam as (lp: unknown) => unknown,
              initialPageParam: undefined,
            }),
        },
        create: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as (() => void) | undefined,
            }),
        },
        update: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        close: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        archive: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        restore: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        delete: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        castVote: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        updateVote: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
        deleteVote: {
          useMutation: (opts: Record<string, unknown> = {}) =>
            rq.useMutation({
              mutationFn: () => Promise.resolve({}),
              onSuccess: opts.onSuccess as
                | ((data: unknown, variables: unknown) => void)
                | undefined,
            }),
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
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
      title: `Poll ${id}`,
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

function makeRawPollVote(id: string, pollId: string): PollVoteRaw {
  const encrypted = encryptPollVoteInput({ comment: "My comment" }, TEST_MASTER_KEY);
  return {
    id: id as PollVoteId,
    pollId: pollId as PollId,
    optionId: "opt-1" as PollOptionId,
    voter: null,
    isVeto: false,
    votedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
  };
}

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Query tests ──────────────────────────────────────────────────────
describe("usePoll", () => {
  it("returns decrypted poll data", async () => {
    fixtures.set("poll.get", makeRawPoll("p-1"));
    const { result } = renderHookWithProviders(() => usePoll("p-1" as PollId));

    let data: Awaited<ReturnType<typeof usePoll>>["data"] | undefined;
    await waitFor(() => {
      data = result.current.data;
      expect(data).toBeDefined();
    });
    expect(data?.title).toBe("Poll p-1");
    expect(data?.description).toBeNull();
    expect(data?.kind).toBe("standard");
    expect(data?.status).toBe("open");
    expect(data?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => usePoll("p-1" as PollId), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("poll.get", makeRawPoll("p-1"));
    const { result, rerender } = renderHookWithProviders(() => usePoll("p-1" as PollId));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("usePollsList", () => {
  it("returns decrypted paginated polls", async () => {
    const raw1 = makeRawPoll("p-1");
    const raw2 = makeRawPoll("p-2");
    fixtures.set("poll.list", { data: [raw1, raw2], nextCursor: null });

    const { result } = renderHookWithProviders(() => usePollsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(2);
    expect(pages[0]?.data[0]?.title).toBe("Poll p-1");
    expect(pages[0]?.data[1]?.title).toBe("Poll p-2");
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => usePollsList(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    fixtures.set("poll.list", { data: [makeRawPoll("p-1")], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => usePollsList());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("usePollResults", () => {
  it("returns poll results data", async () => {
    const resultsFixture = {
      pollId: "p-1" as PollId,
      totalVotes: 5,
      vetoCount: 0,
      optionCounts: [{ optionId: "opt-1" as PollOptionId, count: 5 }],
    };
    fixtures.set("poll.results", resultsFixture);

    const { result } = renderHookWithProviders(() => usePollResults("p-1" as PollId));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const data = result.current.data as typeof resultsFixture;
    expect(data.totalVotes).toBe(5);
    expect(data.pollId).toBe("p-1");
  });
});

describe("usePollVotes", () => {
  it("returns decrypted paginated votes", async () => {
    const rawVote = makeRawPollVote("v-1", "p-1");
    fixtures.set("poll.listVotes", { data: [rawVote], nextCursor: null });

    const { result } = renderHookWithProviders(() => usePollVotes("p-1" as PollId));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const pages = result.current.data?.pages ?? [];
    expect(pages).toHaveLength(1);
    expect(pages[0]?.data).toHaveLength(1);
    expect(pages[0]?.data[0]?.comment).toBe("My comment");
    expect(pages[0]?.data[0]?.archived).toBe(false);
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => usePollVotes("p-1" as PollId), {
      masterKey: null,
    });
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("select is stable across rerenders", async () => {
    const rawVote = makeRawPollVote("v-1", "p-1");
    fixtures.set("poll.listVotes", { data: [rawVote], nextCursor: null });
    const { result, rerender } = renderHookWithProviders(() => usePollVotes("p-1" as PollId));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

// ── Mutation tests ───────────────────────────────────────────────────
describe("useCreatePoll", () => {
  it("invalidates list on success", async () => {
    const { result } = renderHookWithProviders(() => useCreatePoll());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useUpdatePoll", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdatePoll());

    await act(() => result.current.mutateAsync({ pollId: "p-1" } as never));

    await waitFor(() => {
      expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-1",
      });
      expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useClosePoll", () => {
  it("invalidates get, list, and results on success", async () => {
    const { result } = renderHookWithProviders(() => useClosePoll());

    await act(() => result.current.mutateAsync({ pollId: "p-1" } as never));

    await waitFor(() => {
      expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-1",
      });
      expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
      expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-1",
      });
    });
  });
});

describe("useArchivePoll", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useArchivePoll());

    await act(() => result.current.mutateAsync({ pollId: "p-2" } as never));

    await waitFor(() => {
      expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-2",
      });
      expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useRestorePoll", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useRestorePoll());

    await act(() => result.current.mutateAsync({ pollId: "p-3" } as never));

    await waitFor(() => {
      expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-3",
      });
      expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useDeletePoll", () => {
  it("invalidates get and list on success", async () => {
    const { result } = renderHookWithProviders(() => useDeletePoll());

    await act(() => result.current.mutateAsync({ pollId: "p-4" } as never));

    await waitFor(() => {
      expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-4",
      });
      expect(mockUtils.poll.list.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});

describe("useCastVote", () => {
  it("invalidates results, listVotes, and get on success", async () => {
    const { result } = renderHookWithProviders(() => useCastVote());

    await act(() => result.current.mutateAsync({ pollId: "p-1" } as never));

    await waitFor(() => {
      expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-1",
      });
      expect(mockUtils.poll.listVotes.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-1",
      });
      expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-1",
      });
    });
  });
});

describe("useUpdateVote", () => {
  it("invalidates results, listVotes, and get on success", async () => {
    const { result } = renderHookWithProviders(() => useUpdateVote());

    await act(() => result.current.mutateAsync({ pollId: "p-2" } as never));

    await waitFor(() => {
      expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-2",
      });
      expect(mockUtils.poll.listVotes.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-2",
      });
      expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-2",
      });
    });
  });
});

describe("useDeleteVote", () => {
  it("invalidates results, listVotes, and get on success", async () => {
    const { result } = renderHookWithProviders(() => useDeleteVote());

    await act(() => result.current.mutateAsync({ pollId: "p-3" } as never));

    await waitFor(() => {
      expect(mockUtils.poll.results.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-3",
      });
      expect(mockUtils.poll.listVotes.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-3",
      });
      expect(mockUtils.poll.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
        pollId: "p-3",
      });
    });
  });
});
