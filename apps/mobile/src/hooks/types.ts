import type { AppRouter } from "@pluralscape/api-client/trpc";
import type { SystemId } from "@pluralscape/types";
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { TRPCHookResult } from "@trpc/react-query/shared";

export type TRPCError = TRPCClientErrorLike<AppRouter>;
export type TRPCQuery<T> = TRPCHookResult & UseQueryResult<T, TRPCError>;
export type TRPCInfiniteQuery<T> = TRPCHookResult &
  UseInfiniteQueryResult<InfiniteData<T>, TRPCError>;
export type TRPCMutation<TData, TVars> = TRPCHookResult &
  UseMutationResult<TData, TRPCError, TVars>;
export type TRPCMutationCtx<TData, TVars, TCtx> = TRPCHookResult &
  UseMutationResult<TData, TRPCError, TVars, TCtx>;

/**
 * Query result for hooks that read from either local SQLite or remote tRPC.
 * Uses a broad error union so both plain `Error` (local) and
 * `TRPCClientErrorLike` (remote) are assignable.
 */
export type DataQuery<T> = UseQueryResult<T, Error | TRPCError>;

/**
 * List query that returns paginated infinite data from either
 * local SQLite or remote tRPC. Legacy flat-array arm retained
 * for manual hooks that haven't migrated to useInfiniteQuery.
 */
export type DataListQuery<TItem> =
  | UseQueryResult<readonly TItem[], Error | TRPCError>
  | UseInfiniteQueryResult<
      InfiniteData<{ readonly data: readonly TItem[]; readonly nextCursor: string | null }>,
      Error | TRPCError
    >;

export interface SystemIdOverride {
  readonly systemId?: SystemId;
}

/** Default page size for list queries. */
export const DEFAULT_LIST_LIMIT = 20;
