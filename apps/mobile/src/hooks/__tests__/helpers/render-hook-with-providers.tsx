// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, type RenderHookResult } from "@testing-library/react";

import { CryptoProvider } from "../../../providers/crypto-provider.js";
import { SystemProvider } from "../../../providers/system-provider.js";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./test-crypto.js";

import type { KdfMasterKey } from "@pluralscape/crypto";
import type { PropsWithChildren } from "react";

interface RenderOptions {
  readonly masterKey?: KdfMasterKey | null;
}

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderHookWithProviders<TResult>(
  hook: () => TResult,
  opts?: RenderOptions,
): RenderHookResult<TResult, unknown> {
  const masterKey = opts?.masterKey !== undefined ? opts.masterKey : TEST_MASTER_KEY;
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <SystemProvider systemId={TEST_SYSTEM_ID}>
          <CryptoProvider masterKey={masterKey}>{children}</CryptoProvider>
        </SystemProvider>
      </QueryClientProvider>
    );
  }

  return renderHook(hook, { wrapper: Wrapper });
}

export { TEST_MASTER_KEY, TEST_SYSTEM_ID };
