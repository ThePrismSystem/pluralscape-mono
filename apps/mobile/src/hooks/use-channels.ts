import { trpc } from "@pluralscape/api-client/trpc";
import { decryptChannel } from "@pluralscape/data/transforms/channel";

import { rowToChannel } from "../data/row-transforms.js";

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
  type TRPCMutation,
} from "./types.js";

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  ChannelPage as ChannelRawPage,
  ChannelRaw,
} from "@pluralscape/data/transforms/channel";
import type { Archived, Channel, ChannelId } from "@pluralscape/types";

interface ChannelListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useChannel(
  channelId: ChannelId,
  opts?: SystemIdOverride,
): DataQuery<Channel | Archived<Channel>> {
  return useOfflineFirstQuery<ChannelRaw, Channel | Archived<Channel>>({
    queryKey: ["channels", channelId],
    table: "own_channels",
    entityId: channelId,
    rowTransform: rowToChannel,
    decrypt: decryptChannel,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.channel.get.useQuery({ systemId, channelId }, { enabled, select }) as DataQuery<
        Channel | Archived<Channel>
      >,
  });
}

export function useChannelsList(
  opts?: ChannelListOpts,
): DataListQuery<Channel | Archived<Channel>> {
  return useOfflineFirstInfiniteQuery<ChannelRaw, Channel | Archived<Channel>>({
    queryKey: ["channels", "list", opts?.includeArchived ?? false],
    table: "own_channels",
    rowTransform: rowToChannel,
    decrypt: decryptChannel,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.channel.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: ChannelRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<Channel | Archived<Channel>>,
  });
}

export function useCreateChannel(): TRPCMutation<
  RouterOutput["channel"]["create"],
  RouterInput["channel"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.channel.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.channel.list.invalidate({ systemId });
    },
  });
}

export function useUpdateChannel(): TRPCMutation<
  RouterOutput["channel"]["update"],
  RouterInput["channel"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.channel.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.channel.get.invalidate({ systemId, channelId: variables.channelId });
      void utils.channel.list.invalidate({ systemId });
    },
  });
}

export function useArchiveChannel(): TRPCMutation<
  RouterOutput["channel"]["archive"],
  RouterInput["channel"]["archive"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.channel.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.channel.get.invalidate({ systemId, channelId: variables.channelId });
      void utils.channel.list.invalidate({ systemId });
    },
  });
}

export function useRestoreChannel(): TRPCMutation<
  RouterOutput["channel"]["restore"],
  RouterInput["channel"]["restore"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.channel.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.channel.get.invalidate({ systemId, channelId: variables.channelId });
      void utils.channel.list.invalidate({ systemId });
    },
  });
}

export function useDeleteChannel(): TRPCMutation<
  RouterOutput["channel"]["delete"],
  RouterInput["channel"]["delete"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.channel.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.channel.get.invalidate({ systemId, channelId: variables.channelId });
      void utils.channel.list.invalidate({ systemId });
    },
  });
}
