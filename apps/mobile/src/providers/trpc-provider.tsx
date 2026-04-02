import { trpc } from "@pluralscape/api-client/trpc";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";

import { getApiBaseUrl } from "../config.js";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** HTTP status code for unauthorized responses. */
const HTTP_UNAUTHORIZED = 401;

interface TRPCProviderProps {
  readonly children: ReactNode;
  readonly queryClient: QueryClient;
  readonly getToken: () => Promise<string | null>;
  readonly onUnauthorized: () => void;
}

export function TRPCProvider({
  children,
  queryClient,
  getToken,
  onUnauthorized,
}: TRPCProviderProps): React.JSX.Element {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getApiBaseUrl()}/v1/trpc`,
          headers: async () => {
            const token = await getToken();
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
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children}
    </trpc.Provider>
  );
}
