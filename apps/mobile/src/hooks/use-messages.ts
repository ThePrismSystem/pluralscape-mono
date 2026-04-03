import { trpc } from "@pluralscape/api-client/trpc";
import { decryptMessage, decryptMessagePage } from "@pluralscape/data/transforms/message";

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
import type { ArchivedChatMessage, ChannelId, ChatMessage, MessageId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawMessage = RouterOutput["message"]["get"];
type RawMessagePage = RouterOutput["message"]["list"];
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
): TRPCQuery<ChatMessage | ArchivedChatMessage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.message.get.useQuery(
    { systemId, channelId, messageId },
    {
      enabled: masterKey !== null,
      select: (raw: RawMessage): ChatMessage | ArchivedChatMessage => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptMessage(raw, masterKey);
      },
    },
  );
}

export function useMessagesList(
  channelId: ChannelId,
  opts?: MessageListOpts,
): TRPCInfiniteQuery<MessagePage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.message.list.useInfiniteQuery(
    {
      systemId,
      channelId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
      before: opts?.before,
      after: opts?.after,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawMessagePage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawMessagePage>): InfiniteData<MessagePage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => decryptMessagePage(page, key)),
        };
      },
    },
  );
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
