import { trpc } from "@pluralscape/api-client/trpc";
import { decryptBoardMessage } from "@pluralscape/data/transforms/board-message";

import { rowToBoardMessage } from "../data/row-transforms/index.js";

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
import type { BoardMessagePage as BoardMessageWirePage } from "@pluralscape/data/transforms/board-message";
import type { Archived, BoardMessage, BoardMessageId, BoardMessageWire } from "@pluralscape/types";

interface BoardMessageListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useBoardMessage(
  boardMessageId: BoardMessageId,
  opts?: SystemIdOverride,
): DataQuery<BoardMessage | Archived<BoardMessage>> {
  return useOfflineFirstQuery<BoardMessageWire, BoardMessage | Archived<BoardMessage>>({
    queryKey: ["board_messages", boardMessageId],
    table: "own_board_messages",
    entityId: boardMessageId,
    rowTransform: rowToBoardMessage,
    decrypt: decryptBoardMessage,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.boardMessage.get.useQuery(
        { systemId, boardMessageId },
        { enabled, select },
      ) as DataQuery<BoardMessage | Archived<BoardMessage>>,
  });
}

export function useBoardMessagesList(
  opts?: BoardMessageListOpts,
): DataListQuery<BoardMessage | Archived<BoardMessage>> {
  return useOfflineFirstInfiniteQuery<BoardMessageWire, BoardMessage | Archived<BoardMessage>>({
    queryKey: ["board_messages", "list", opts?.includeArchived ?? false],
    table: "own_board_messages",
    rowTransform: rowToBoardMessage,
    decrypt: decryptBoardMessage,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.boardMessage.list.useInfiniteQuery(
        {
          systemId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: BoardMessageWirePage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<BoardMessage | Archived<BoardMessage>>,
  });
}

export function useCreateBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["create"],
  RouterInput["boardMessage"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.boardMessage.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}

export function useUpdateBoardMessage(): TRPCMutation<
  RouterOutput["boardMessage"]["update"],
  RouterInput["boardMessage"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.boardMessage.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.boardMessage.archive.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.boardMessage.restore.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.boardMessage.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.boardMessage.pin.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.boardMessage.unpin.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.boardMessage.reorder.useMutation(mutOpts),
    onInvalidate: (utils, systemId) => {
      void utils.boardMessage.list.invalidate({ systemId });
    },
  });
}
