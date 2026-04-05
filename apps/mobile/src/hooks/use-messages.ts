import { trpc } from "@pluralscape/api-client/trpc";
import { decryptMessage, decryptMessagePage } from "@pluralscape/data/transforms/message";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToMessage } from "../data/row-transforms.js";
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

import type { RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  MessagePage as MessageRawPage,
  MessageRaw,
} from "@pluralscape/data/transforms/message";
import type { ArchivedChatMessage, ChannelId, ChatMessage, MessageId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type MessagePage = {
  readonly data: (ChatMessage | ArchivedChatMessage)[];
  readonly nextCursor: string | null;
};

interface MessageOpts extends SystemIdOverride {
  readonly timestamp?: number;
}

interface MessageListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly before?: number;
  readonly after?: number;
}

export function useMessage(
  channelId: ChannelId,
  messageId: MessageId,
  opts?: MessageOpts,
): DataQuery<ChatMessage | ArchivedChatMessage> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectMessage = useCallback(
    (raw: MessageRaw): ChatMessage | ArchivedChatMessage => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptMessage(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["messages", channelId, messageId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM own_messages WHERE id = ? AND channel_id = ?", [
        messageId,
        channelId,
      ]);
      if (!row) throw new Error("Message not found");
      return rowToMessage(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.message.get.useQuery(
    { systemId, channelId, messageId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectMessage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useMessagesList(
  channelId: ChannelId,
  opts?: MessageListOpts,
): DataListQuery<ChatMessage | ArchivedChatMessage> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectMessagePage = useCallback(
    (data: InfiniteData<MessageRawPage>): InfiniteData<MessagePage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptMessagePage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["messages", "list", systemId, channelId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM own_messages WHERE system_id = ? AND channel_id = ? ORDER BY timestamp DESC"
        : "SELECT * FROM own_messages WHERE system_id = ? AND channel_id = ? AND archived = 0 ORDER BY timestamp DESC";
      return localDb.queryAll(sql, [systemId, channelId]).map(rowToMessage);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.message.list.useInfiniteQuery(
    {
      systemId,
      channelId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      before: opts?.before,
      after: opts?.after,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: MessageRawPage) => lastPage.nextCursor,
      select: selectMessagePage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useCreateMessage(): TRPCMutation<
  RouterOutput["message"]["create"],
  RouterInput["message"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.message.create.useMutation({
    onSuccess: (_data, variables) => {
      void utils.message.list.invalidate({ systemId, channelId: variables.channelId });
    },
  });
}

export function useUpdateMessage(): TRPCMutation<
  RouterOutput["message"]["update"],
  RouterInput["message"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.message.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.message.get.invalidate({
        systemId,
        channelId: variables.channelId,
        messageId: variables.messageId,
      });
      void utils.message.list.invalidate({ systemId, channelId: variables.channelId });
    },
  });
}

export function useArchiveMessage(): TRPCMutation<
  RouterOutput["message"]["archive"],
  RouterInput["message"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.message.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.message.get.invalidate({
        systemId,
        channelId: variables.channelId,
        messageId: variables.messageId,
      });
      void utils.message.list.invalidate({ systemId, channelId: variables.channelId });
    },
  });
}

export function useRestoreMessage(): TRPCMutation<
  RouterOutput["message"]["restore"],
  RouterInput["message"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.message.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.message.get.invalidate({
        systemId,
        channelId: variables.channelId,
        messageId: variables.messageId,
      });
      void utils.message.list.invalidate({ systemId, channelId: variables.channelId });
    },
  });
}

export function useDeleteMessage(): TRPCMutation<
  RouterOutput["message"]["delete"],
  RouterInput["message"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.message.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.message.get.invalidate({
        systemId,
        channelId: variables.channelId,
        messageId: variables.messageId,
      });
      void utils.message.list.invalidate({ systemId, channelId: variables.channelId });
    },
  });
}
