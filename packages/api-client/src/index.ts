import createClient from "openapi-fetch";

import type { paths } from "./generated/api-types.js";

export type { paths } from "./generated/api-types.js";
export type { MaybeOptionalInit } from "openapi-fetch";

export interface ApiClientConfig {
  readonly baseUrl: string;
  readonly getToken: () => string | null | Promise<string | null>;
  readonly platform?: "web" | "mobile";
}

const HTTP_TOO_MANY_REQUESTS = 429;
const RETRY_AFTER_DEFAULT_MS = 1_000;
const SECONDS_TO_MS = 1_000;

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

  client.use({
    async onResponse({ response, request }) {
      if (response.status === HTTP_TOO_MANY_REQUESTS) {
        const retryAfter = response.headers.get("Retry-After");
        const delayMs = retryAfter ? Number(retryAfter) * SECONDS_TO_MS : RETRY_AFTER_DEFAULT_MS;
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        return fetch(request);
      }
      return response;
    },
  });

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
