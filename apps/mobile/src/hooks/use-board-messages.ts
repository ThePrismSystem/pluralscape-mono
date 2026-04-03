import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptBoardMessage,
  decryptBoardMessagePage,
} from "@pluralscape/data/transforms/board-message";

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
import type { Archived, BoardMessage, BoardMessageId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

type RawBoardMessage = RouterOutput["boardMessage"]["get"];
type RawBoardMessagePage = RouterOutput["boardMessage"]["list"];
type BoardMessagePage = {
  readonly data: (BoardMessage | Archived<BoardMessage>)[];
  readonly nextCursor: string | null;
};

interface BoardMessageListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useBoardMessage(
  boardMessageId: BoardMessageId,
  opts?: SystemIdOverride,
): TRPCQuery<BoardMessage | Archived<BoardMessage>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.boardMessage.get.useQuery(
    { systemId, boardMessageId },
    {
      enabled: masterKey !== null,
      select: (raw: RawBoardMessage): BoardMessage | Archived<BoardMessage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptBoardMessage(raw, masterKey);
      },
    },
  );
}

export function useBoardMessagesList(
  opts?: BoardMessageListOpts,
): TRPCInfiniteQuery<BoardMessagePage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  return trpc.boardMessage.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawBoardMessagePage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawBoardMessagePage>): InfiniteData<BoardMessagePage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => decryptBoardMessagePage(page, key)),
        };
      },
    },
  );
}

export function useCreateBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["create"],
  RouterInput["boardMessage"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.boardMessage.create.useMutation({
    onSuccess: () => {
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}

export function useUpdateBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["update"],
  RouterInput["boardMessage"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.boardMessage.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.boardMessage.get.invalidate({
        systemId,
        boardMessageId: variables.boardMessageId,
      });
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}

export function useArchiveBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["archive"],
  RouterInput["boardMessage"]["archive"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.boardMessage.archive.useMutation({
    onSuccess: (_data, variables) => {
      void utils.boardMessage.get.invalidate({
        systemId,
        boardMessageId: variables.boardMessageId,
      });
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}

export function useRestoreBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["restore"],
  RouterInput["boardMessage"]["restore"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.boardMessage.restore.useMutation({
    onSuccess: (_data, variables) => {
      void utils.boardMessage.get.invalidate({
        systemId,
        boardMessageId: variables.boardMessageId,
      });
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}

export function useDeleteBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["delete"],
  RouterInput["boardMessage"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.boardMessage.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.boardMessage.get.invalidate({
        systemId,
        boardMessageId: variables.boardMessageId,
      });
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}

export function usePinBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["pin"],
  RouterInput["boardMessage"]["pin"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.boardMessage.pin.useMutation({
    onSuccess: (_data, variables) => {
      void utils.boardMessage.get.invalidate({
        systemId,
        boardMessageId: variables.boardMessageId,
      });
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}

export function useUnpinBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["unpin"],
  RouterInput["boardMessage"]["unpin"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.boardMessage.unpin.useMutation({
    onSuccess: (_data, variables) => {
      void utils.boardMessage.get.invalidate({
        systemId,
        boardMessageId: variables.boardMessageId,
      });
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}

export function useReorderBoardMessages(): TRPCMutation<
  RouterOutput["boardMessage"]["reorder"],
  RouterInput["boardMessage"]["reorder"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.boardMessage.reorder.useMutation({
    onSuccess: () => {
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}
