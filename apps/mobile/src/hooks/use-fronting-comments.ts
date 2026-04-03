import { trpc } from "@pluralscape/api-client/trpc";
import { decryptFrontingComment } from "@pluralscape/data/transforms/fronting-comment";

import { useMasterKey } from "../providers/crypto-provider.js";
import { useActiveSystemId } from "../providers/system-provider.js";

import type { AppRouter, RouterInput, RouterOutput } from "@pluralscape/api-client/trpc";
import type {
  FrontingComment,
  FrontingCommentId,
  FrontingSessionId,
  SystemId,
} from "@pluralscape/types";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { TRPCHookResult } from "@trpc/react-query/shared";

/** Default page size for fronting comment list queries. */
const DEFAULT_LIST_LIMIT = 20;

type RawComment = RouterOutput["frontingComment"]["get"];
type RawCommentPage = RouterOutput["frontingComment"]["list"];
type TRPCError = TRPCClientErrorLike<AppRouter>;
type CommentPage = { readonly items: FrontingComment[]; readonly nextCursor: string | null };
type TRPCQuery<T> = TRPCHookResult & UseQueryResult<T, TRPCError>;
type TRPCInfiniteQuery<T> = TRPCHookResult & UseInfiniteQueryResult<InfiniteData<T>, TRPCError>;
type TRPCMutation<TData, TVars> = TRPCHookResult & UseMutationResult<TData, TRPCError, TVars>;

interface SystemIdOverride {
  readonly systemId?: SystemId;
}

interface FrontingCommentListOpts extends SystemIdOverride {
  readonly limit?: number;
  readonly includeArchived?: boolean;
}

export function useFrontingComment(
  commentId: FrontingCommentId,
  sessionId: FrontingSessionId,
  opts?: SystemIdOverride,
): TRPCQuery<FrontingComment> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.frontingComment.get.useQuery(
    { systemId, sessionId, commentId },
    {
      enabled: masterKey !== null,
      select: (raw: RawComment): FrontingComment => {
        if (masterKey === null) throw new Error("masterKey is null");
        return decryptFrontingComment(raw, masterKey);
      },
    },
  );
}

export function useFrontingCommentsList(
  sessionId: FrontingSessionId,
  opts?: FrontingCommentListOpts,
): TRPCInfiniteQuery<CommentPage> {
  const systemId = opts?.systemId ?? useActiveSystemId();
  const masterKey = useMasterKey();

  return trpc.frontingComment.list.useInfiniteQuery(
    {
      systemId,
      sessionId,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      includeArchived: opts?.includeArchived ?? false,
    },
    {
      enabled: masterKey !== null,
      getNextPageParam: (lastPage: RawCommentPage) => lastPage.nextCursor,
      select: (data: InfiniteData<RawCommentPage>): InfiniteData<CommentPage> => {
        if (masterKey === null) throw new Error("masterKey is null");
        const key = masterKey;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            items: page.data.map((item) => decryptFrontingComment(item, key)),
            nextCursor: page.nextCursor,
          })),
        };
      },
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
