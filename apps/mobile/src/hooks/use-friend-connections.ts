import { trpc } from "@pluralscape/api-client/trpc";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/index.js";
import { rowToFriendConnection } from "../data/row-transforms.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  ArchivedFriendConnection,
  FriendConnection,
  FriendConnectionId,
} from "@pluralscape/types";

type FriendConnectionRemote = RouterOutput["friend"]["get"];
type FriendConnectionPage = RouterOutput["friend"]["list"];

interface FriendConnectionListOpts {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly status?: "pending" | "accepted" | "blocked" | "removed";
}

export function useFriendConnection(
  connectionId: FriendConnectionId,
): DataQuery<FriendConnection | ArchivedFriendConnection | FriendConnectionRemote> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const auth = useAuth();
  const accountId = auth.snapshot.credentials?.accountId ?? null;

  const localQuery = useQuery({
    queryKey: ["friend_connections", connectionId, accountId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      if (accountId === null) throw new Error("accountId is null");
      const row = localDb.queryOne(
        "SELECT * FROM friend_connections WHERE id = ? AND account_id = ?",
        [connectionId, accountId],
      );
      if (!row) throw new Error("Friend connection not found");
      return rowToFriendConnection(row);
    },
    enabled: source === "local" && localDb !== null && accountId !== null,
  });

  const remoteQuery = trpc.friend.get.useQuery({ connectionId }, { enabled: source === "remote" });

  return source === "local" ? localQuery : remoteQuery;
}

export function useFriendConnectionsList(
  opts?: FriendConnectionListOpts,
):
  | DataListQuery<FriendConnection | ArchivedFriendConnection>
  | ReturnType<typeof trpc.friend.list.useInfiniteQuery> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const auth = useAuth();
  const accountId = auth.snapshot.credentials?.accountId ?? null;

  const localQuery = useQuery({
    queryKey: [
      "friend_connections",
      "list",
      accountId,
      opts?.includeArchived ?? false,
      opts?.status ?? null,
    ],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      if (accountId === null) throw new Error("accountId is null");
      const includeArchived = opts?.includeArchived ?? false;
      const status = opts?.status;

      let sql = "SELECT * FROM friend_connections WHERE account_id = ?";
      const params: unknown[] = [accountId];

      if (status !== undefined) {
        sql += " AND status = ?";
        params.push(status);
      }
      if (!includeArchived) {
        sql += " AND archived = 0";
      }

      return localDb.queryAll(sql, params).map(rowToFriendConnection);
    },
    enabled: source === "local" && localDb !== null && accountId !== null,
  });

  const remoteQuery = trpc.friend.list.useInfiniteQuery(
    {
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      status: opts?.status,
    },
    {
      enabled: source === "remote",
      getNextPageParam: (lastPage: FriendConnectionPage) => lastPage.nextCursor,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
