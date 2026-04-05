import { trpc } from "@pluralscape/api-client/trpc";
import { decryptChannel, decryptChannelPage } from "@pluralscape/data/transforms/channel";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToChannelRow } from "../data/row-transforms.js";
import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import {
  DEFAULT_LIST_LIMIT,
  type DataListQuery,
  type DataQuery,
  type SystemIdOverride,
  type TRPCMutation,
} from "./types.js";
import { useLocalDb, useQuerySource } from "./use-query-source.js";

import type { ChannelLocalRow } from "../data/row-transforms.js";
import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  ChannelPage as ChannelRawPage,
  ChannelRaw,
} from "@pluralscape/data/transforms/channel";
import type { Archived, Channel, ChannelId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

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
): DataQuery<Channel | Archived<Channel> | ChannelLocalRow> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectChannel = useCallback(
    (raw: ChannelRaw): Channel | Archived<Channel> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptChannel(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["channels", channelId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM own_channels WHERE id = ?", [channelId]);
      if (!row) throw new Error("Channel not found");
      return rowToChannelRow(row);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.channel.get.useQuery(
    { systemId, channelId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectChannel,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useChannelsList(
  opts?: ChannelListOpts,
): DataListQuery<Channel | Archived<Channel> | ChannelLocalRow> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectChannelPage = useCallback(
    (data: InfiniteData<ChannelRawPage>): InfiniteData<ChannelPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptChannelPage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["channels", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM own_channels WHERE system_id = ?"
        : "SELECT * FROM own_channels WHERE system_id = ? AND archived = 0";
      return localDb.queryAll(sql, [systemId]).map(rowToChannelRow);
    },
    enabled: source === "local",
  });

  const remoteQuery = trpc.channel.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: ChannelRawPage) => lastPage.nextCursor,
      select: selectChannelPage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
