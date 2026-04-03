import { trpc } from "@pluralscape/api-client/trpc";
import { decryptChannel, decryptChannelPage } from "@pluralscape/data/transforms/channel";
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
import type { Archived, Channel, ChannelId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawChannel = RouterOutput["channel"]["get"];
type RawChannelPage = RouterOutput["channel"]["list"];
type ChannelPage = {
  readonly data: (Channel | Archived<Channel>)[];
  readonly nextCursor: string | null;
};

interface ChannelListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useChannel(
  channelId: ChannelId,
  opts?: SystemIdOverride,
): TRPCQuery<Channel | Archived<Channel>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectChannel = useCallback(
    (raw: RawChannel): Channel | Archived<Channel> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptChannel(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.channel.get.useQuery(
    { systemId, channelId },
    {
      enabled: masterKey !== null,
      select: selectChannel,
    },
  );
}

export function useChannelsList(opts?: ChannelListOpts): TRPCInfiniteQuery<ChannelPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectChannelPage = useCallback(
    (data: InfiniteData<RawChannelPage>): InfiniteData<ChannelPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptChannelPage(page, key)),
      };
    },
    [masterKey],
  );

  return trpc.channel.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawChannelPage) => lastPage.nextCursor,
      select: selectChannelPage,
    },
  );
}

export function useCreateChannel(): TRPCMutation<
  RouterOutput["channel"]["create"],
  RouterInput["channel"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.channel.create.useMutation({
    onSuccess: () => {
      void utils.channel.list.invalidate({ systemId });
    },
  });
}

export function useUpdateChannel(): TRPCMutation<
  RouterOutput["channel"]["update"],
  RouterInput["channel"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.channel.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.channel.get.invalidate({ systemId, channelId: variables.channelId });
      void utils.channel.list.invalidate({ systemId });
    },
  });
}

export function useArchiveChannel(): TRPCMutation<
  RouterOutput["channel"]["archive"],
  RouterInput["channel"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.channel.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.channel.get.invalidate({ systemId, channelId: variables.channelId });
      void utils.channel.list.invalidate({ systemId });
    },
  });
}

export function useRestoreChannel(): TRPCMutation<
  RouterOutput["channel"]["restore"],
  RouterInput["channel"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.channel.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.channel.get.invalidate({ systemId, channelId: variables.channelId });
      void utils.channel.list.invalidate({ systemId });
    },
  });
}

export function useDeleteChannel(): TRPCMutation<
  RouterOutput["channel"]["delete"],
  RouterInput["channel"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.channel.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.channel.get.invalidate({ systemId, channelId: variables.channelId });
      void utils.channel.list.invalidate({ systemId });
    },
  });
}
