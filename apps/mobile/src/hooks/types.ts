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

export interface SystemIdOverride {
  readonly systemId?: SystemId;
}

/** Default page size for list queries. */
export const DEFAULT_LIST_LIMIT = 20;
