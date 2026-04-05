import { trpc } from "@pluralscape/api-client/trpc";
import {
  decryptBoardMessage,
  decryptBoardMessagePage,
} from "@pluralscape/data/transforms/board-message";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { rowToBoardMessage } from "../data/row-transforms.js";
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
  BoardMessagePage as BoardMessageRawPage,
  BoardMessageRaw,
} from "@pluralscape/data/transforms/board-message";
import type { Archived, BoardMessage, BoardMessageId } from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";

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
): DataQuery<BoardMessage | Archived<BoardMessage>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectBoardMessage = useCallback(
    (raw: BoardMessageRaw): BoardMessage | Archived<BoardMessage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptBoardMessage(raw, masterKey);
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["boardMessages", boardMessageId],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const row = localDb.queryOne("SELECT * FROM own_board_messages WHERE id = ?", [
        boardMessageId,
      ]);
      if (!row) throw new Error("Board message not found");
      return rowToBoardMessage(row);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.boardMessage.get.useQuery(
    { systemId, boardMessageId },
    {
      enabled: source === "remote" && masterKey !== null,
      select: selectBoardMessage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
}

export function useBoardMessagesList(
  opts?: BoardMessageListOpts,
): DataListQuery<BoardMessage | Archived<BoardMessage>> {
  const source = useQuerySource();
  const localDb = useLocalDb();
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectBoardMessagePage = useCallback(
    (data: InfiniteData<BoardMessageRawPage>): InfiniteData<BoardMessagePage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => decryptBoardMessagePage(page, key)),
      };
    },
    [masterKey],
  );

  const localQuery = useQuery({
    queryKey: ["boardMessages", "list", systemId, opts?.includeArchived ?? false],
    queryFn: () => {
      if (localDb === null) throw new Error("localDb is null");
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM own_board_messages WHERE system_id = ? ORDER BY created_at DESC"
        : "SELECT * FROM own_board_messages WHERE system_id = ? AND archived = 0 ORDER BY created_at DESC";
      return localDb.queryAll(sql, [systemId]).map(rowToBoardMessage);
    },
    enabled: source === "local" && localDb !== null,
  });

  const remoteQuery = trpc.boardMessage.list.useInfiniteQuery(
    {
      systemId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: source === "remote" && masterKey !== null,
      getNextPageParam: (lastPage: BoardMessageRawPage) => lastPage.nextCursor,
      select: selectBoardMessagePage,
    },
  );

  return source === "local" ? localQuery : remoteQuery;
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
