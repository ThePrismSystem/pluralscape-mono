import { trpc } from "@pluralscape/api-client/trpc";
import { decryptMessage } from "@pluralscape/data/transforms/message";

import { rowToMessage } from "../data/row-transforms/index.js";

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
  MessagePage as MessageRawPage,
  MessageRaw,
} from "@pluralscape/data/transforms/message";
import type { ArchivedChatMessage, ChannelId, ChatMessage, MessageId } from "@pluralscape/types";

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
  return useOfflineFirstQuery<MessageRaw, ChatMessage | ArchivedChatMessage>({
    queryKey: ["messages", channelId, messageId],
    table: "own_messages",
    entityId: messageId,
    rowTransform: rowToMessage,
    decrypt: decryptMessage,
    systemIdOverride: opts,
    // Custom local query: messages are scoped by channel_id in addition to id
    localQueryFn: (localDb) => {
      const row = localDb.queryOne("SELECT * FROM own_messages WHERE id = ? AND channel_id = ?", [
        messageId,
        channelId,
      ]);
      if (!row) throw new Error("Message not found");
      return rowToMessage(row);
    },
    useRemote: ({ systemId, enabled, select }) =>
      trpc.message.get.useQuery(
        { systemId, channelId, messageId },
        { enabled, select },
      ) as DataQuery<ChatMessage | ArchivedChatMessage>,
  });
}

export function useMessagesList(
  channelId: ChannelId,
  opts?: MessageListOpts,
): DataListQuery<ChatMessage | ArchivedChatMessage> {
  return useOfflineFirstInfiniteQuery<MessageRaw, ChatMessage | ArchivedChatMessage>({
    queryKey: ["messages", "list", channelId, opts?.includeArchived ?? false],
    table: "own_messages",
    rowTransform: rowToMessage,
    decrypt: decryptMessage,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    // Custom local query: scoped by channel_id, ordered by timestamp DESC
    localQueryFn: (localDb, systemId) => {
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM own_messages WHERE system_id = ? AND channel_id = ? ORDER BY timestamp DESC"
        : "SELECT * FROM own_messages WHERE system_id = ? AND channel_id = ? AND archived = 0 ORDER BY timestamp DESC";
      return localDb.queryAll(sql, [systemId, channelId]).map(rowToMessage);
    },
    useRemote: ({ systemId, enabled, select }) =>
      trpc.message.list.useInfiniteQuery(
        {
          systemId,
          channelId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
          before: opts?.before,
          after: opts?.after,
        },
        {
          enabled,
          getNextPageParam: (lastPage: MessageRawPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<ChatMessage | ArchivedChatMessage>,
  });
}

export function useCreateMessage(): TRPCMutation<
  RouterOutput["message"]["create"],
  RouterInput["message"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.message.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.message.list.invalidate({ systemId, channelId: variables.channelId });
    },
  });
}

export function useUpdateMessage(): TRPCMutation<
  RouterOutput["message"]["update"],
  RouterInput["message"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.message.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.message.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.message.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.message.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.message.get.invalidate({
        systemId,
        channelId: variables.channelId,
        messageId: variables.messageId,
      });
      void utils.message.list.invalidate({ systemId, channelId: variables.channelId });
    },
  });
}
