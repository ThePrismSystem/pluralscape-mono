/**
 * Playwright fixtures for typed tRPC client access.
 *
 * Provides three clients:
 *   - `trpc`       — authenticated as `registeredAccount`
 *   - `secondTrpc` — authenticated as `secondRegisteredAccount`
 *   - `anonTrpc`   — unauthenticated (no Authorization header)
 */
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";

import { test as authTest } from "./auth.fixture.js";

import type { AppRouter } from "@pluralscape/api/trpc";

/** Port must match playwright.config.ts E2E_PORT. */
const TRPC_URL = "http://localhost:10099/v1/trpc";

/** Maximum URL length before httpBatchLink splits into multiple requests. */
const MAX_URL_LENGTH = 2083;

/** Maximum operations per batch request. */
const MAX_BATCH_ITEMS = 10;

interface TRPCFixtures {
  trpc: ReturnType<typeof createTRPCClient<AppRouter>>;
  secondTrpc: ReturnType<typeof createTRPCClient<AppRouter>>;
  anonTrpc: ReturnType<typeof createTRPCClient<AppRouter>>;
}

function makeTrpcClient(token?: string): ReturnType<typeof createTRPCClient<AppRouter>> {
  return createTRPCClient<AppRouter>({
    links: [
      loggerLink(),
      httpBatchLink({
        url: TRPC_URL,
        maxURLLength: MAX_URL_LENGTH,
        maxItems: MAX_BATCH_ITEMS,
        headers: () => (token ? { Authorization: `Bearer ${token}` } : {}),
      }),
    ],
  });
}

export const test = authTest.extend<TRPCFixtures>({
  trpc: async ({ registeredAccount }, use) => {
    await use(makeTrpcClient(registeredAccount.sessionToken));
  },
  secondTrpc: async ({ secondRegisteredAccount }, use) => {
    await use(makeTrpcClient(secondRegisteredAccount.sessionToken));
  },
  anonTrpc: async ({}, use) => {
    await use(makeTrpcClient());
  },
});

export { expect } from "@playwright/test";
