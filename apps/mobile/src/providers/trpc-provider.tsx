import { MAX_BATCH_ITEMS, MAX_URL_LENGTH, trpc } from "@pluralscape/api-client/trpc";
import { TRPCClientError } from "@trpc/client";
import { httpBatchLink, httpSubscriptionLink, loggerLink, splitLink } from "@trpc/client";
import { useState } from "react";

import { getApiBaseUrl } from "../config.js";

import type { AppRouter } from "@pluralscape/api-client/trpc";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

const HTTP_UNAUTHORIZED = 401;

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
export function createMemoizedTokenGetter(
  getToken: () => Promise<string | null>,
): () => Promise<string | null> {
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
    const url = `${getApiBaseUrl()}/v1/trpc`;

    const sharedHeaders = async () => {
      const token = await getMemoizedToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const sharedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, init);
      if (response.status === HTTP_UNAUTHORIZED) {
        onUnauthorized();
      }
      return response;
    };

    return trpc.createClient({
      links: [
        loggerLink({ enabled: () => __DEV__ }),
        splitLink({
          condition: (op) => op.type === "subscription",
          true: httpSubscriptionLink({
            url,
            headers: sharedHeaders,
          }),
          false: httpBatchLink({
            url,
            maxURLLength: MAX_URL_LENGTH,
            maxItems: MAX_BATCH_ITEMS,
            headers: sharedHeaders,
            fetch: sharedFetch,
          }),
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
