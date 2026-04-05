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

/**
 * Query result for hooks that read from either local SQLite or remote tRPC.
 * Uses a broad error union so both plain `Error` (local) and
 * `TRPCClientErrorLike` (remote) are assignable.
 */
export type DataQuery<T> = UseQueryResult<T, Error | TRPCError>;

/**
 * List query that returns a flat array from local SQLite
 * or paginated infinite data from remote tRPC.
 */
export type DataListQuery<TItem> =
  | UseQueryResult<readonly TItem[], Error | TRPCError>
  | (TRPCHookResult &
      UseInfiniteQueryResult<
        InfiniteData<{ readonly data: TItem[]; readonly nextCursor: string | null }>,
        TRPCError
      >);

export interface SystemIdOverride {
  readonly systemId?: SystemId;
}

/** Default page size for list queries. */
export const DEFAULT_LIST_LIMIT = 20;
