import { trpc } from "@pluralscape/api-client/trpc";

import {
  DEFAULT_LIST_LIMIT,
  type TRPCInfiniteQuery,
  type TRPCMutation,
  type TRPCQuery,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";

type FriendConnectionPage = RouterOutput["friend"]["list"];
type FriendConnection = RouterOutput["friend"]["get"];

interface FriendConnectionListOpts {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly status?: "pending" | "accepted" | "blocked" | "removed";
}

export function useFriendConnection(
  connectionId: RouterInput["friend"]["get"]["connectionId"],
): TRPCQuery<FriendConnection> {
  return trpc.friend.get.useQuery({ connectionId });
}

export function useFriendConnectionsList(
  opts?: FriendConnectionListOpts,
): TRPCInfiniteQuery<FriendConnectionPage> {
  return trpc.friend.list.useInfiniteQuery(
    {
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      status: opts?.status,
    },
    {
      getNextPageParam: (lastPage: FriendConnectionPage) => lastPage.nextCursor,
    },
  );
}

export function useAcceptFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["accept"],
  RouterInput["friend"]["accept"]
> {
  const utils = trpc.useUtils();

  return trpc.friend.accept.useMutation({
    onSuccess: (_data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useRejectFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["reject"],
  RouterInput["friend"]["reject"]
> {
  const utils = trpc.useUtils();

  return trpc.friend.reject.useMutation({
    onSuccess: (_data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useBlockFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["block"],
  RouterInput["friend"]["block"]
> {
  const utils = trpc.useUtils();

  return trpc.friend.block.useMutation({
    onSuccess: (_data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useRemoveFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["remove"],
  RouterInput["friend"]["remove"]
> {
  const utils = trpc.useUtils();

  return trpc.friend.remove.useMutation({
    onSuccess: (_data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useArchiveFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["archive"],
  RouterInput["friend"]["archive"]
> {
  const utils = trpc.useUtils();

  return trpc.friend.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useRestoreFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["restore"],
  RouterInput["friend"]["restore"]
> {
  const utils = trpc.useUtils();

  return trpc.friend.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useUpdateFriendVisibility(): TRPCMutation<
  RouterOutput["friend"]["updateVisibility"],
  RouterInput["friend"]["updateVisibility"]
> {
  const utils = trpc.useUtils();

  return trpc.friend.updateVisibility.useMutation({
    onSuccess: (_data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}
