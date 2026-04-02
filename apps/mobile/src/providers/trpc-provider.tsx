import { trpc } from "@pluralscape/api-client/trpc";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";

import { getApiBaseUrl } from "../config.js";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

interface TRPCProviderProps {
  readonly children: ReactNode;
  readonly queryClient: QueryClient;
  readonly getToken: () => Promise<string | null>;
}

export function TRPCProvider({
  children,
  queryClient,
  getToken,
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
