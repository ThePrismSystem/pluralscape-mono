import createClient from "openapi-fetch";

import type { paths } from "./generated/api-types.js";

export type { paths } from "./generated/api-types.js";
export type { MaybeOptionalInit } from "openapi-fetch";

export interface ApiClientConfig {
  readonly baseUrl: string;
  readonly getToken: () => string | null | Promise<string | null>;
  readonly platform?: "web" | "mobile";
}

export function createApiClient(config: ApiClientConfig): ReturnType<typeof createClient<paths>> {
  const client = createClient<paths>({
    baseUrl: config.baseUrl,
    headers: {
      "X-Client-Platform": config.platform ?? "web",
    },
  });

  client.use({
    async onRequest({ request }) {
      const token = await config.getToken();
      if (token) {
        request.headers.set("Authorization", `Bearer ${token}`);
      }
      return request;
    },
  });

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
