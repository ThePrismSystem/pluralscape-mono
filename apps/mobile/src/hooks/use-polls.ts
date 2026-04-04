import { trpc } from "@pluralscape/api-client/trpc";
import { decryptPoll, decryptPollPage, decryptPollVote } from "@pluralscape/data/transforms/poll";
import { useCallback } from "react";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type SystemIdOverride,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  PollDecrypted,
  PollPage as PollRawPage,
  PollRaw,
  PollVoteDecrypted,
} from "@pluralscape/data/transforms/poll";
import type { Archived, PollId, PollStatus } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

// These remain as RouterOutput derivations because the endpoints return non-standard
// shapes (aggregated results, paginated votes) with no corresponding transform-level wire types.
type RawPollResults = RouterOutput["poll"]["results"];
type RawPollVotePage = RouterOutput["poll"]["listVotes"];

type PollPage = {
  readonly data: (PollDecrypted | Archived<PollDecrypted>)[];
  readonly nextCursor: string | null;
};

type PollVotePage = {
  readonly data: (PollVoteDecrypted | Archived<PollVoteDecrypted>)[];
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

export function usePoll(
  pollId: PollId,
  opts?: SystemIdOverride,
): TRPCQuery<PollDecrypted | Archived<PollDecrypted>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPoll = useCallback(
    (raw: PollRaw): PollDecrypted | Archived<PollDecrypted> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptPoll(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.poll.get.useQuery(
    { systemId, pollId },
    {
      enabled: masterKey !== null,
      select: selectPoll,
    },
  );
}

export function usePollsList(opts?: PollListOpts): TRPCInfiniteQuery<PollPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectPollPage = useCallback(
    (data: InfiniteData<PollRawPage>): InfiniteData<PollPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptPollPage(page, key)),
      };
    },
    [masterKey],
  );

  return trpc.poll.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      status: opts?.status,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: PollRawPage) => lastPage.nextCursor,
      select: selectPollPage,
    },
  );
}

export function usePollResults(pollId: PollId, opts?: SystemIdOverride): TRPCQuery<RawPollResults> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;

  return trpc.poll.results.useQuery({ systemId, pollId });
}

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
          data: page.data.map((item): PollVoteDecrypted | Archived<PollVoteDecrypted> =>
            decryptPollVote(item, key),
          ),
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.create.useMutation({
    onSuccess: () => {
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useUpdatePoll(): TRPCMutation<
  RouterOutput["poll"]["update"],
  RouterInput["poll"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useClosePoll(): TRPCMutation<
  RouterOutput["poll"]["close"],
  RouterInput["poll"]["close"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.close.useMutation({
    onSuccess: (_data, variables) => {
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useRestorePoll(): TRPCMutation<
  RouterOutput["poll"]["restore"],
  RouterInput["poll"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useDeletePoll(): TRPCMutation<
  RouterOutput["poll"]["delete"],
  RouterInput["poll"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.list.invalidate({ systemId });
    },
  });
}

export function useCastVote(): TRPCMutation<
  RouterOutput["poll"]["castVote"],
  RouterInput["poll"]["castVote"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.castVote.useMutation({
    onSuccess: (_data, variables) => {
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.updateVote.useMutation({
    onSuccess: (_data, variables) => {
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
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.poll.deleteVote.useMutation({
    onSuccess: (_data, variables) => {
      void utils.poll.results.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.listVotes.invalidate({ systemId, pollId: variables.pollId });
      void utils.poll.get.invalidate({ systemId, pollId: variables.pollId });
    },
  });
}
