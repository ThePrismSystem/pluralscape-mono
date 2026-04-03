/**
 * Playwright fixtures for typed tRPC client access.
 *
 * Provides three clients:
 *   - `trpc`       — authenticated as `registeredAccount`
 *   - `secondTrpc` — authenticated as `secondRegisteredAccount`
 *   - `anonTrpc`   — unauthenticated (no Authorization header)
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";

import { test as authTest } from "./auth.fixture.js";

import type { AppRouter } from "@pluralscape/api/trpc";

/** Port must match playwright.config.ts E2E_PORT. */
const TRPC_URL = "http://localhost:10099/v1/trpc";

interface TRPCFixtures {
  trpc: ReturnType<typeof createTRPCClient<AppRouter>>;
  secondTrpc: ReturnType<typeof createTRPCClient<AppRouter>>;
  anonTrpc: ReturnType<typeof createTRPCClient<AppRouter>>;
}

function makeTrpcClient(token?: string): ReturnType<typeof createTRPCClient<AppRouter>> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: TRPC_URL,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
