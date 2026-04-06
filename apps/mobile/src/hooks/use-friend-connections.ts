import { trpc } from "@pluralscape/api-client/trpc";

import { useAuth } from "../auth/index.js";
import { rowToFriendConnection } from "../data/row-transforms/index.js";

import {
  useOfflineFirstQuery,
  useOfflineFirstInfiniteQuery,
  useDomainMutation,
  useRemoteOnlyQuery,
} from "./factories.js";
import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  ArchivedFriendConnection,
  FriendConnection,
  FriendConnectionId,
} from "@pluralscape/types";

type FriendConnectionRaw = RouterOutput["friend"]["get"];
type FriendConnectionPage = RouterOutput["friend"]["list"];

interface FriendConnectionListOpts {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly status?: "pending" | "accepted" | "blocked" | "removed";
}

export function useFriendConnection(
  connectionId: FriendConnectionId,
): DataQuery<FriendConnection | ArchivedFriendConnection> {
  const auth = useAuth();
  const accountId = auth.snapshot.credentials?.accountId ?? null;

  return useOfflineFirstQuery<FriendConnectionRaw, FriendConnection | ArchivedFriendConnection>({
    queryKey: ["friend_connections", connectionId, accountId],
    table: "friend_connections",
    entityId: connectionId,
    rowTransform: rowToFriendConnection,
    localQueryFn: (localDb) => {
      if (accountId === null) throw new Error("accountId is null");
      const row = localDb.queryOne(
        "SELECT * FROM friend_connections WHERE id = ? AND account_id = ?",
        [connectionId, accountId],
      );
      if (!row) throw new Error("Friend connection not found");
      return rowToFriendConnection(row);
    },
    useRemote: ({ enabled }) =>
      trpc.friend.get.useQuery({ connectionId }, { enabled }) as DataQuery<
        FriendConnection | ArchivedFriendConnection
      >,
  });
}

export function useFriendConnectionsList(
  opts?: FriendConnectionListOpts,
): DataListQuery<FriendConnection | ArchivedFriendConnection> {
  const auth = useAuth();
  const accountId = auth.snapshot.credentials?.accountId ?? null;

  return useOfflineFirstInfiniteQuery<
    FriendConnectionRaw,
    FriendConnection | ArchivedFriendConnection
  >({
    queryKey: [
      "friend_connections",
      "list",
      accountId,
      opts?.includeArchived ?? false,
      opts?.status ?? null,
    ],
    table: "friend_connections",
    rowTransform: rowToFriendConnection,
    injectSystemId: false,
    includeArchived: opts?.includeArchived,
    localQueryFn: (localDb) => {
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
      sql += " ORDER BY created_at DESC";

      return localDb.queryAll(sql, params).map(rowToFriendConnection);
    },
    useRemote: ({ enabled, select }) =>
      trpc.friend.list.useInfiniteQuery(
        {
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
          status: opts?.status,
        },
        {
          enabled,
          getNextPageParam: (lastPage: FriendConnectionPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<FriendConnection | ArchivedFriendConnection>,
  });
}

export function useAcceptFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["accept"],
  RouterInput["friend"]["accept"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friend.accept.useMutation(mutOpts),
    onInvalidate: (utils, _systemId, _data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useRejectFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["reject"],
  RouterInput["friend"]["reject"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friend.reject.useMutation(mutOpts),
    onInvalidate: (utils, _systemId, _data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useBlockFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["block"],
  RouterInput["friend"]["block"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friend.block.useMutation(mutOpts),
    onInvalidate: (utils, _systemId, _data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useRemoveFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["remove"],
  RouterInput["friend"]["remove"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friend.remove.useMutation(mutOpts),
    onInvalidate: (utils, _systemId, _data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useArchiveFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["archive"],
  RouterInput["friend"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friend.archive.useMutation(mutOpts),
    onInvalidate: (utils, _systemId, _data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useRestoreFriendConnection(): TRPCMutation<
  RouterOutput["friend"]["restore"],
  RouterInput["friend"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friend.restore.useMutation(mutOpts),
    onInvalidate: (utils, _systemId, _data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useUpdateFriendVisibility(): TRPCMutation<
  RouterOutput["friend"]["updateVisibility"],
  RouterInput["friend"]["updateVisibility"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friend.updateVisibility.useMutation(mutOpts),
    onInvalidate: (utils, _systemId, _data, variables) => {
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
      void utils.friend.list.invalidate();
    },
  });
}

export function useFriendNotificationPrefs(
  connectionId: FriendConnectionId,
  opts?: { enabled?: boolean },
): DataQuery<RouterOutput["friend"]["getNotifications"]> {
  return useRemoteOnlyQuery<RouterOutput["friend"]["getNotifications"]>({
    useRemote: ({ enabled }) =>
      trpc.friend.getNotifications.useQuery(
        { connectionId },
        { enabled: enabled && (opts?.enabled ?? true) },
      ) as DataQuery<RouterOutput["friend"]["getNotifications"]>,
  });
}

export function useUpdateFriendNotificationPrefs(): TRPCMutation<
  RouterOutput["friend"]["updateNotifications"],
  RouterInput["friend"]["updateNotifications"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.friend.updateNotifications.useMutation(mutOpts),
    onInvalidate: (utils, _systemId, _data, variables) => {
      void utils.friend.getNotifications.invalidate({ connectionId: variables.connectionId });
      void utils.friend.get.invalidate({ connectionId: variables.connectionId });
    },
  });
}

export function useListReceivedKeyGrants(opts?: {
  enabled?: boolean;
}): DataQuery<RouterOutput["friend"]["listReceivedKeyGrants"]> {
  return useRemoteOnlyQuery<RouterOutput["friend"]["listReceivedKeyGrants"]>({
    useRemote: ({ enabled }) =>
      trpc.friend.listReceivedKeyGrants.useQuery(undefined, {
        enabled: enabled && (opts?.enabled ?? true),
      }) as DataQuery<RouterOutput["friend"]["listReceivedKeyGrants"]>,
  });
}
