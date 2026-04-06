import { trpc } from "@pluralscape/api-client/trpc";

import { rowToFriendCode } from "../data/row-transforms.js";

import { useOfflineFirstInfiniteQuery, useDomainMutation } from "./factories.js";
import { DEFAULT_LIST_LIMIT, type DataListQuery, type TRPCMutation } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type { ArchivedFriendCode, FriendCode } from "@pluralscape/types";

type FriendCodeRaw = RouterOutput["friendCode"]["list"]["data"][number];
type FriendCodePage = RouterOutput["friendCode"]["list"];

interface FriendCodeListOpts {
  readonly limit?: number;
}

export function useFriendCodesList(
  opts?: FriendCodeListOpts,
): DataListQuery<FriendCode | ArchivedFriendCode> {
  return useOfflineFirstInfiniteQuery<FriendCodeRaw, FriendCode | ArchivedFriendCode>({
    queryKey: ["friend_codes", "list"],
    table: "friend_codes",
    rowTransform: rowToFriendCode,
    injectSystemId: false,
    useRemote: ({ enabled, select }) =>
      trpc.friendCode.list.useInfiniteQuery(
        {
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
        },
        {
          enabled,
          getNextPageParam: (lastPage: FriendCodePage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<FriendCode | ArchivedFriendCode>,
  });
}

export function useGenerateFriendCode(): TRPCMutation<
  RouterOutput["friendCode"]["generate"],
  void
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friendCode.generate.useMutation(mutOpts),
    onInvalidate: (utils) => {
      void utils.friendCode.list.invalidate();
    },
  });
}

export function useRedeemFriendCode(): TRPCMutation<
  RouterOutput["friendCode"]["redeem"],
  RouterInput["friendCode"]["redeem"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friendCode.redeem.useMutation(mutOpts),
    onInvalidate: (utils) => {
      // Cross-resource: redeeming a code also creates a friend connection
      void utils.friendCode.list.invalidate();
      void utils.friend.list.invalidate();
    },
  });
}

export function useArchiveFriendCode(): TRPCMutation<
  RouterOutput["friendCode"]["archive"],
  RouterInput["friendCode"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friendCode.archive.useMutation(mutOpts),
    onInvalidate: (utils) => {
      void utils.friendCode.list.invalidate();
    },
  });
}
