// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, type RenderHookResult } from "@testing-library/react";
import { vi } from "vitest";

import { DataLayerCtx } from "../../../data/DataLayerProvider.js";
import { PlatformProvider } from "../../../platform/PlatformProvider.js";
import { CryptoProvider } from "../../../providers/crypto-provider.js";
import { SystemProvider } from "../../../providers/system-provider.js";
import { SyncCtx } from "../../../sync/sync-context.js";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./test-crypto.js";

import type { DataLayerContextValue } from "../../../data/DataLayerProvider.js";
import type { LocalDatabase } from "../../../data/local-database.js";
import type { PlatformContext } from "../../../platform/types.js";
import type { SyncContextValue } from "../../../sync/sync-context.js";
import type { KdfMasterKey, SodiumAdapter } from "@pluralscape/crypto";
import type { DataLayerEventMap, EventBus } from "@pluralscape/sync";
import type {
  OfflineQueueAdapter,
  SqliteDriver,
  SyncStorageAdapter,
} from "@pluralscape/sync/adapters";
import type { PropsWithChildren } from "react";

interface RenderOptions {
  readonly masterKey?: KdfMasterKey | null;
  /**
   * Controls the query source reported by `useQuerySource`.
   * "local" — platform backend is "sqlite" and sync is bootstrapped.
   * "remote" — platform backend is "indexeddb" and sync is not bootstrapped.
   * Defaults to "remote" for backwards compatibility.
   */
  readonly querySource?: "local" | "remote";
  /**
   * Mock local database injected into the DataLayer context.
   * Only meaningful when querySource is "local".
   */
  readonly localDb?: LocalDatabase | null;
}

const STUB_SODIUM: SodiumAdapter = {
  init: vi.fn(),
  isReady: vi.fn().mockReturnValue(true),
  constants: {} as SodiumAdapter["constants"],
  supportsSecureMemzero: false,
  aeadEncrypt: vi.fn(),
  aeadDecrypt: vi.fn(),
  aeadKeygen: vi.fn(),
  boxKeypair: vi.fn(),
  boxSeedKeypair: vi.fn(),
  boxEasy: vi.fn(),
  boxOpenEasy: vi.fn(),
  signKeypair: vi.fn(),
  signSeedKeypair: vi.fn(),
  signDetached: vi.fn(),
  signVerifyDetached: vi.fn(),
  pwhash: vi.fn(),
  pwhashStr: vi.fn(),
  pwhashStrVerify: vi.fn(),
  kdfDeriveFromKey: vi.fn(),
  kdfKeygen: vi.fn(),
  genericHash: vi.fn(),
  randomBytes: vi.fn(),
  memzero: vi.fn(),
};

const STUB_REMOTE_PLATFORM: PlatformContext = {
  capabilities: {
    hasSecureStorage: false,
    hasBiometric: false,
    hasBackgroundSync: false,
    hasNativeMemzero: false,
    storageBackend: "indexeddb",
  },
  storage: {
    backend: "indexeddb",
    storageAdapter: {} as SyncStorageAdapter,
    offlineQueueAdapter: {} as OfflineQueueAdapter,
  },
  crypto: STUB_SODIUM,
};

const STUB_LOCAL_PLATFORM: PlatformContext = {
  capabilities: {
    hasSecureStorage: false,
    hasBiometric: false,
    hasBackgroundSync: false,
    hasNativeMemzero: false,
    storageBackend: "sqlite",
  },
  storage: {
    backend: "sqlite",
    driver: {} as SqliteDriver,
  },
  crypto: STUB_SODIUM,
};

function createStubEventBus(): EventBus<DataLayerEventMap> {
  return {
    emit: vi.fn(),
    on: vi.fn().mockReturnValue(vi.fn()),
    removeAll: vi.fn(),
  };
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
  const querySource = opts?.querySource ?? "remote";
  const localDb = opts?.localDb ?? null;
  const queryClient = createTestQueryClient();

  const isLocal = querySource === "local";
  const platformContext = isLocal ? STUB_LOCAL_PLATFORM : STUB_REMOTE_PLATFORM;

  const syncValue: SyncContextValue = {
    engine: null,
    isBootstrapped: isLocal,
    progress: null,
  };

  const dataLayerValue: DataLayerContextValue | null = isLocal
    ? {
        eventBus: createStubEventBus(),
        localDb: localDb ?? ({} as LocalDatabase),
      }
    : null;

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <PlatformProvider context={platformContext}>
          <SyncCtx.Provider value={syncValue}>
            <DataLayerCtx.Provider value={dataLayerValue}>
              <SystemProvider systemId={TEST_SYSTEM_ID}>
                <CryptoProvider masterKey={masterKey}>{children}</CryptoProvider>
              </SystemProvider>
            </DataLayerCtx.Provider>
          </SyncCtx.Provider>
        </PlatformProvider>
      </QueryClientProvider>
    );
  }

  return renderHook(hook, { wrapper: Wrapper });
}

export { TEST_MASTER_KEY, TEST_SYSTEM_ID };
