import { trpc } from "@pluralscape/api-client/trpc";
import { decryptPoll, decryptPollVote } from "@pluralscape/data/transforms/poll";
import { useCallback } from "react";

import { rowToPoll } from "../data/row-transforms/index.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
} from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { PollPage as PollWirePage } from "@pluralscape/data/transforms/poll";
import type { Archived, Poll, PollId, PollStatus, PollVote, PollWire } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

// These remain as RouterOutput derivations because the endpoints return non-standard
// shapes (aggregated results, paginated votes) with no corresponding transform-level wire types.
type RawPollResults = RouterOutput["poll"]["results"];
type RawPollVotePage = RouterOutput["poll"]["listVotes"];

type PollVotePage = {
  readonly data: (PollVote | Archived<PollVote>)[];
  readonly nextCursor: string | null;
};

interface PollListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly status?: PollStatus;
}

interface PollVoteListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function usePoll(pollId: PollId, opts?: SystemIdOverride): DataQuery<Poll | Archived<Poll>> {
  return useOfflineFirstQuery<PollWire, Poll | Archived<Poll>>({
    queryKey: ["polls", pollId],
    table: "own_polls",
    entityId: pollId,
    rowTransform: rowToPoll,
    decrypt: decryptPoll,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.poll.get.useQuery({ systemId, pollId }, { enabled, select }) as DataQuery<
        Poll | Archived<Poll>
      >,
  });
}

export function usePollsList(opts?: PollListOpts): DataListQuery<Poll | Archived<Poll>> {
  return useOfflineFirstInfiniteQuery<PollWire, Poll | Archived<Poll>>({
    queryKey: ["polls", "list", opts?.includeArchived ?? false, opts?.status],
    table: "own_polls",
    rowTransform: rowToPoll,
    decrypt: decryptPoll,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.poll.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
          status: opts?.status,
        },
        {
          enabled,
          getNextPageParam: (lastPage: PollWirePage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<Poll | Archived<Poll>>,
  });
}

// Poll results are server-aggregated (not encrypted), no offline-first pattern needed
export function usePollResults(pollId: PollId, opts?: SystemIdOverride): TRPCQuery<RawPollResults> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.poll.results.useQuery({ systemId, pollId });
}

// Poll votes use encrypted select but are remote-only (no local SQLite table)
export function usePollVotes(
  pollId: PollId,
  opts?: PollVoteListOpts,
): TRPCInfiniteQuery<PollVotePage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPollVotePage = useCallback(
    (data: InfiniteData<RawPollVotePage>): InfiniteData<PollVotePage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          data: page.data.map((item): PollVote | Archived<PollVote> => decryptPollVote(item, key)),
          nextCursor: page.nextCursor,
        })),
      };
    },
    [masterKey],
  );

  return trpc.poll.listVotes.useInfiniteQuery(
    {
      systemId,
      pollId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawPollVotePage) => lastPage.nextCursor,
      select: selectPollVotePage,
    },
  );
}

export function useCreatePoll(): TRPCMutation<
  RouterOutput["poll"]["create"],
  RouterInput["poll"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useUpdatePoll(): TRPCMutation<
  RouterOutput["poll"]["update"],
  RouterInput["poll"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useClosePoll(): TRPCMutation<
  RouterOutput["poll"]["close"],
  RouterInput["poll"]["close"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.close.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
      void utils.poll.results.invalidate({ systemId, pollId: variables.pollId });
    },
  });
}

export function useArchivePoll(): TRPCMutation<
  RouterOutput["poll"]["archive"],
  RouterInput["poll"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useRestorePoll(): TRPCMutation<
  RouterOutput["poll"]["restore"],
  RouterInput["poll"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useDeletePoll(): TRPCMutation<
  RouterOutput["poll"]["delete"],
  RouterInput["poll"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useCastVote(): TRPCMutation<
  RouterOutput["poll"]["castVote"],
  RouterInput["poll"]["castVote"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.castVote.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.poll.results.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.listVotes.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
    },
  });
}

export function useUpdateVote(): TRPCMutation<
  RouterOutput["poll"]["updateVote"],
  RouterInput["poll"]["updateVote"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.updateVote.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.poll.results.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.listVotes.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
    },
  });
}

export function useDeleteVote(): TRPCMutation<
  RouterOutput["poll"]["deleteVote"],
  RouterInput["poll"]["deleteVote"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.poll.deleteVote.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.poll.results.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.listVotes.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
    },
  });
}
