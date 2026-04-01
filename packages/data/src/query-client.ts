import { QueryClient } from "@tanstack/react-query";

const STALE_TIME = 30_000;
const GC_TIME = 300_000;
const QUERY_RETRY = 2;
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
