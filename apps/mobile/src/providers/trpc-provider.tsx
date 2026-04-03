import { trpc } from "@pluralscape/api-client/trpc";
import { TRPCClientError } from "@trpc/client";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { useState } from "react";

import { getApiBaseUrl } from "../config.js";

import type { AppRouter } from "@pluralscape/api-client/trpc";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** HTTP status code for unauthorized responses. */
const HTTP_UNAUTHORIZED = 401;

/** Maximum URL length before httpBatchLink splits into multiple requests. */
const MAX_URL_LENGTH = 2083;

/** Maximum operations per batch request. */
const MAX_BATCH_ITEMS = 10;

/** Type guard for typed tRPC client errors. */
export function isTRPCClientError(cause: unknown): cause is TRPCClientError<AppRouter> {
  return cause instanceof TRPCClientError;
}

interface TRPCProviderProps {
  readonly children: ReactNode;
  readonly queryClient: QueryClient;
  readonly getToken: () => Promise<string | null>;
  readonly onUnauthorized: () => void;
}

/**
 * Memoize an async token fetch so concurrent requests share one in-flight call.
 * Prevents React Query's isFetching from getting stuck when multiple requests
 * each trigger an independent token refresh.
 */
function createMemoizedTokenGetter(getToken: () => Promise<string | null>) {
  let pending: Promise<string | null> | null = null;
  return () => {
    pending ??= getToken().finally(() => {
      pending = null;
    });
    return pending;
  };
}

export function TRPCProvider({
  children,
  queryClient,
  getToken,
  onUnauthorized,
}: TRPCProviderProps): React.JSX.Element {
  const [trpcClient] = useState(() => {
    const getMemoizedToken = createMemoizedTokenGetter(getToken);
    return trpc.createClient({
      links: [
        loggerLink({ enabled: () => __DEV__ }),
        httpBatchLink({
          url: `${getApiBaseUrl()}/v1/trpc`,
          maxURLLength: MAX_URL_LENGTH,
          maxItems: MAX_BATCH_ITEMS,
          headers: async () => {
            const token = await getMemoizedToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
          fetch: async (input, init) => {
            const response = await fetch(input, init);
            if (response.status === HTTP_UNAUTHORIZED) {
              onUnauthorized();
            }
            return response;
          },
        }),
      ],
    });
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
