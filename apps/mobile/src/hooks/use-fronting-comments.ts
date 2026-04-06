import { trpc } from "@pluralscape/api-client/trpc";
import { decryptFrontingComment } from "@pluralscape/data/transforms/fronting-comment";

import { rowToFrontingComment } from "../data/row-transforms/index.js";

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
  FrontingCommentPage,
  FrontingCommentRaw,
} from "@pluralscape/data/transforms/fronting-comment";
import type {
  Archived,
  FrontingComment,
  FrontingCommentId,
  FrontingSessionId,
} from "@pluralscape/types";

interface FrontingCommentListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useFrontingComment(
  commentId: FrontingCommentId,
  sessionId: FrontingSessionId,
  opts?: SystemIdOverride,
): DataQuery<FrontingComment | Archived<FrontingComment>> {
  return useOfflineFirstQuery<FrontingCommentRaw, FrontingComment | Archived<FrontingComment>>({
    queryKey: ["fronting_comments", commentId],
    table: "fronting_comments",
    entityId: commentId,
    rowTransform: rowToFrontingComment,
    decrypt: decryptFrontingComment,
    systemIdOverride: opts,
    useRemote: ({ systemId, enabled, select }) =>
      trpc.frontingComment.get.useQuery(
        { systemId, sessionId, commentId },
        { enabled, select },
      ) as DataQuery<FrontingComment | Archived<FrontingComment>>,
  });
}

export function useFrontingCommentsList(
  sessionId: FrontingSessionId,
  opts?: FrontingCommentListOpts,
): DataListQuery<FrontingComment | Archived<FrontingComment>> {
  return useOfflineFirstInfiniteQuery<
    FrontingCommentRaw,
    FrontingComment | Archived<FrontingComment>
  >({
    queryKey: ["fronting_comments", "list", sessionId, opts?.includeArchived ?? false],
    table: "fronting_comments",
    rowTransform: rowToFrontingComment,
    decrypt: decryptFrontingComment,
    includeArchived: opts?.includeArchived,
    systemIdOverride: opts,
    localQueryFn: (localDb) => {
      const includeArchived = opts?.includeArchived ?? false;
      const sql = includeArchived
        ? "SELECT * FROM fronting_comments WHERE fronting_session_id = ? ORDER BY created_at DESC"
        : "SELECT * FROM fronting_comments WHERE fronting_session_id = ? AND archived = 0 ORDER BY created_at DESC";
      return localDb.queryAll(sql, [sessionId]).map(rowToFrontingComment);
    },
    useRemote: ({ systemId, enabled, select }) =>
      trpc.frontingComment.list.useInfiniteQuery(
        {
          systemId,
          sessionId,
          limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
          includeArchived: opts?.includeArchived ?? false,
        },
        {
          enabled,
          getNextPageParam: (lastPage: FrontingCommentPage) => lastPage.nextCursor,
          select,
        },
      ) as DataListQuery<FrontingComment | Archived<FrontingComment>>,
  });
}

export function useCreateComment(): TRPCMutation<
  RouterOutput["frontingComment"]["create"],
  RouterInput["frontingComment"]["create"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingComment.create.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingComment.list.invalidate({ systemId, sessionId: variables.sessionId });
    },
  });
}

export function useUpdateComment(): TRPCMutation<
  RouterOutput["frontingComment"]["update"],
  RouterInput["frontingComment"]["update"]
> {
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingComment.update.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
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
  return useDomainMutation({
    useMutation: (mutOpts) => trpc.frontingComment.delete.useMutation(mutOpts),
    onInvalidate: (utils, systemId, _data, variables) => {
      void utils.frontingComment.get.invalidate({
        systemId,
        sessionId: variables.sessionId,
        commentId: variables.commentId,
      });
      void utils.frontingComment.list.invalidate({ systemId, sessionId: variables.sessionId });
    },
  });
}
