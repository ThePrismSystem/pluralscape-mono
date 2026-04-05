import { trpc } from "@pluralscape/api-client/trpc";
import { useQuery } from "@tanstack/react-query";

import { rowToFriendCodeRow, type FriendCodeLocalRow } from "../data/row-transforms.js";

import { DEFAULT_LIST_LIMIT, type DataListQuery, type TRPCMutation } from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type FriendCodePage = RouterOutput["friendCode"]["list"];

interface FriendCodeListOpts {
  readonly limit?: number;
}

export function useFriendCodesList(
  opts?: FriendCodeListOpts,
): DataListQuery<FriendCodeLocalRow> | ReturnType<typeof trpc.friendCode.list.useInfiniteQuery> {
  const source = useQuerySource();
  const localDb = useLocalDb();

  const localQuery = useQuery({
    queryKey: ["friend_codes", "list"],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      return localDb
        .queryAll("SELECT * FROM friend_codes WHERE archived = 0", [])
        .map(rowToFriendCodeRow);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.friendCode.list.useInfiniteQuery(
    {
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
    },
    {
      enabled: source === "remote",
      getNextPageParam: (lastPage: FriendCodePage) => lastPage.nextCursor,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
