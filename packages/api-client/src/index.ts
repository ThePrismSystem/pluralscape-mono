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
const MAX_RETRY_ATTEMPTS = 1;
const RETRY_COUNT_HEADER = "X-Retry-Count";

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
    async onResponse({ response, request, options }) {
      if (response.status !== HTTP_TOO_MANY_REQUESTS) return response;

      const retryCount = Number(request.headers.get(RETRY_COUNT_HEADER) ?? "0");
      if (retryCount >= MAX_RETRY_ATTEMPTS) return response;

      const retryAfter = response.headers.get("Retry-After");
      const parsedDelay = retryAfter ? Number(retryAfter) * SECONDS_TO_MS : NaN;
      const delayMs = Number.isNaN(parsedDelay) ? RETRY_AFTER_DEFAULT_MS : parsedDelay;

      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

      const retryRequest = request.clone();
      retryRequest.headers.set(RETRY_COUNT_HEADER, String(retryCount + 1));

      try {
        return await options.fetch(retryRequest);
      } catch {
        return response;
      }
    },
  });

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
