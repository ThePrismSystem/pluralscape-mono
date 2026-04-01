import { QueryClient } from "@tanstack/react-query";

/** Queries are considered fresh for 30 seconds before refetching. */
const STALE_TIME = 30_000;
/** Inactive query data is garbage-collected after 5 minutes. */
const GC_TIME = 300_000;
/** Failed queries retry up to 2 times before surfacing the error. */
const QUERY_RETRY = 2;
/** Failed mutations retry once before surfacing the error. */
const MUTATION_RETRY = 1;

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        retry: QUERY_RETRY,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: MUTATION_RETRY },
    },
  });
}
