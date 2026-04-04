import { trpc } from "@pluralscape/api-client/trpc";

import { DEFAULT_LIST_LIMIT, type TRPCInfiniteQuery, type TRPCMutation } from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type FriendCodePage = RouterOutput["friendCode"]["list"];

interface FriendCodeListOpts {
  readonly limit?: number;
}

export function useFriendCodesList(opts?: FriendCodeListOpts): TRPCInfiniteQuery<FriendCodePage> {
  return trpc.friendCode.list.useInfiniteQuery(
    {
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      getNextPageParam: (lastPage: FriendCodePage) => lastPage.nextCursor,
    },
  );
}

export function useGenerateFriendCode(): TRPCMutation<
  RouterOutput["friendCode"]["generate"],
  void
> {
  const utils = trpc.useUtils();

  return trpc.friendCode.generate.useMutation({
    onSuccess: () => {
      void utils.friendCode.list.invalidate();
    },
  });
}

export function useRedeemFriendCode(): TRPCMutation<
  RouterOutput["friendCode"]["redeem"],
  RouterInput["friendCode"]["redeem"]
> {
  const utils = trpc.useUtils();

  return trpc.friendCode.redeem.useMutation({
    onSuccess: () => {
      void utils.friendCode.list.invalidate();
      void utils.friend.list.invalidate();
    },
  });
}

export function useArchiveFriendCode(): TRPCMutation<
  RouterOutput["friendCode"]["archive"],
  RouterInput["friendCode"]["archive"]
> {
  const utils = trpc.useUtils();

  return trpc.friendCode.archive.useMutation({
    onSuccess: () => {
      void utils.friendCode.list.invalidate();
    },
  });
}
