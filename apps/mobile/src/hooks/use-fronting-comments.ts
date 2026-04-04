import { trpc } from "@pluralscape/api-client/trpc";
import { decryptFrontingComment } from "@pluralscape/data/transforms/fronting-comment";
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
import type {
  FrontingCommentPage,
  FrontingCommentRaw,
} from "@pluralscape/data/transforms/fronting-comment";
import type {
  Archived,
  FrontingComment,
  FrontingCommentId,
  FrontingSessionId,
} from "@pluralscape/types";
import type { InfiniteData } from "@tanstack/react-query";
type CommentPage = {
  readonly data: (FrontingComment | Archived<FrontingComment>)[];
  readonly nextCursor: string | null;
};

interface FrontingCommentListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useFrontingComment(
  commentId: FrontingCommentId,
  sessionId: FrontingSessionId,
  opts?: SystemIdOverride,
): TRPCQuery<FrontingComment | Archived<FrontingComment>> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFrontingComment = useCallback(
    (raw: FrontingCommentRaw): FrontingComment | Archived<FrontingComment> => {
      if (masterKey === null) throw new Error("masterKey is null");
      return decryptFrontingComment(raw, masterKey);
    },
    [masterKey],
  );

  return trpc.frontingComment.get.useQuery(
    { systemId, sessionId, commentId },
    {
      enabled: masterKey !== null,
      select: selectFrontingComment,
    },
  );
}

export function useFrontingCommentsList(
  sessionId: FrontingSessionId,
  opts?: FrontingCommentListOpts,
): TRPCInfiniteQuery<CommentPage> {
  const activeSystemId = useActiveSystemId();
  const systemId = opts?.systemId ?? activeSystemId;
  const masterKey = useMasterKey();

  const selectFrontingCommentsList = useCallback(
    (data: InfiniteData<FrontingCommentPage>): InfiniteData<CommentPage> => {
      if (masterKey === null) throw new Error("masterKey is null");
      const key = masterKey;
      return {
        ...data,
        pages: data.pages.map((page) => ({
          data: page.data.map((item) => decryptFrontingComment(item, key)),
          nextCursor: page.nextCursor,
        })),
      };
    },
    [masterKey],
  );

  return trpc.frontingComment.list.useInfiniteQuery(
    {
      systemId,
      sessionId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: FrontingCommentPage) => lastPage.nextCursor,
      select: selectFrontingCommentsList,
    },
  );
}

export function useCreateComment(): TRPCMutation<
  RouterOutput["frontingComment"]["create"],
  RouterInput["frontingComment"]["create"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.frontingComment.create.useMutation({
    onSuccess: (_data, variables) => {
      void utils.frontingComment.list.invalidate({ systemId, sessionId: variables.sessionId });
    },
  });
}

export function useUpdateComment(): TRPCMutation<
  RouterOutput["frontingComment"]["update"],
  RouterInput["frontingComment"]["update"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.frontingComment.update.useMutation({
    onSuccess: (_data, variables) => {
      void utils.frontingComment.get.invalidate({
        systemId,
        sessionId: variables.sessionId,
        commentId: variables.commentId,
      });
      void utils.frontingComment.list.invalidate({ systemId, sessionId: variables.sessionId });
    },
  });
}

export function useDeleteComment(): TRPCMutation<
  RouterOutput["frontingComment"]["delete"],
  RouterInput["frontingComment"]["delete"]
> {
  const systemId = useActiveSystemId();
  const utils = trpc.useUtils();

  return trpc.frontingComment.delete.useMutation({
    onSuccess: (_data, variables) => {
      void utils.frontingComment.get.invalidate({
        systemId,
        sessionId: variables.sessionId,
        commentId: variables.commentId,
      });
      void utils.frontingComment.list.invalidate({ systemId, sessionId: variables.sessionId });
    },
  });
}
