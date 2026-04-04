import { createApiClient } from "@pluralscape/api-client";
import React, { createContext, useContext, useMemo } from "react";

import { getApiBaseUrl } from "../config.js";

import type { ApiClient } from "@pluralscape/api-client";
import type { PropsWithChildren } from "react";

const MISSING_PROVIDER = "useRestClient must be used within a RestClientProvider";

const RestClientContext = createContext<ApiClient | null>(null);

interface RestClientProviderProps extends PropsWithChildren {
  readonly getToken: () => string | null | Promise<string | null>;
}

export function RestClientProvider({
  getToken,
  children,
}: RestClientProviderProps): React.JSX.Element {
  const client = useMemo(
    () => createApiClient({ baseUrl: getApiBaseUrl(), getToken, platform: "mobile" }),
    [getToken],
  );

  return <RestClientContext.Provider value={client}>{children}</RestClientContext.Provider>;
}

export function useRestClient(): ApiClient {
  const ctx = useContext(RestClientContext);
  if (ctx === null) {
    throw new Error(MISSING_PROVIDER);
  }
  return ctx;
}
