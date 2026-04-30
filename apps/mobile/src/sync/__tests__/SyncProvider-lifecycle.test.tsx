/**
 * SyncProvider lifecycle tests — engine creation, disposal, auth transitions.
 *
 * Covers: useSync defaults, engine ctor with sqlite/indexeddb, profile selection,
 *         bootstrap gating by connection, dispose-on-unmount, dispose-on-logout,
 *         eventBus + DocumentKeyResolver wiring, useSync-outside-provider guard
 * Companion files: SyncProvider-bootstrap.test.tsx,
 *                  SyncProvider-pipeline.test.tsx,
 *                  SyncProvider-materializer.test.tsx
 */
// @vitest-environment happy-dom
import { brandId } from "@pluralscape/types";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "../../auth/AuthProvider.js";
import type { ConnectionContextValue } from "../../connection/ConnectionProvider.js";
import type { DataLayerContextValue } from "../../data/DataLayerProvider.js";
import type { PlatformContext, PlatformStorage } from "../../platform/types.js";
import type {
  BoxKeypair,
  BoxPublicKey,
  BoxSecretKey,
  BucketKeyCache,
  KdfMasterKey,
  PwhashSalt,
  SignKeypair,
  SignPublicKey,
  SignSecretKey,
} from "@pluralscape/crypto";
import type { ReplicationProfile } from "@pluralscape/sync";
import type { MaterializerDb } from "@pluralscape/sync/materializer";
import type { AccountId, SystemId } from "@pluralscape/types";
import type { ReactNode } from "react";

// ── Branded type helpers ───────────────────────────────────────────

const KDF_KEY_BYTES = 32;
const SIGN_PUB_BYTES = 32;
const SIGN_SEC_BYTES = 64;
const BOX_KEY_BYTES = 32;
const SALT_BYTES = 16;

function checkLen(b: Uint8Array, expected: number): void {
  if (b.length !== expected) throw new Error(`bad bytes len ${String(b.length)}`);
}

function makeKdfMasterKey(): KdfMasterKey {
  const raw = new Uint8Array(KDF_KEY_BYTES).fill(0x01);
  checkLen(raw, KDF_KEY_BYTES);
  return raw as KdfMasterKey;
}

function makeSignKeypair(): SignKeypair {
  const pub = new Uint8Array(SIGN_PUB_BYTES).fill(0x02);
  const sec = new Uint8Array(SIGN_SEC_BYTES).fill(0x03);
  checkLen(pub, SIGN_PUB_BYTES);
  checkLen(sec, SIGN_SEC_BYTES);
  return { publicKey: pub as SignPublicKey, secretKey: sec as SignSecretKey };
}

function makeBoxKeypair(): BoxKeypair {
  const pub = new Uint8Array(BOX_KEY_BYTES).fill(0x04);
  const sec = new Uint8Array(BOX_KEY_BYTES).fill(0x05);
  checkLen(pub, BOX_KEY_BYTES);
  checkLen(sec, BOX_KEY_BYTES);
  return { publicKey: pub as BoxPublicKey, secretKey: sec as BoxSecretKey };
}

function makeSalt(): PwhashSalt {
  const raw = new Uint8Array(SALT_BYTES).fill(0x06);
  checkLen(raw, SALT_BYTES);
  return raw as PwhashSalt;
}

const TEST_SYSTEM_ID = brandId<SystemId>("sys_test123");
const TEST_ACCOUNT_ID = brandId<AccountId>("acc_test");
const TEST_MASTER_KEY = makeKdfMasterKey();
const TEST_SIGN_KEYS = makeSignKeypair();
const TEST_BOX_KEYS = makeBoxKeypair();
const TEST_SALT = makeSalt();
const TEST_TOKEN = "test-session-token";

// ── Mutable mock state ─────────────────────────────────────────────

let mockAuthState: AuthContextValue["snapshot"] = {
  state: "unauthenticated",
  session: null,
  credentials: null,
};
let mockConnectionStatus: ConnectionContextValue["status"] = "disconnected";

function makeMockMaterializerDb(): MaterializerDb {
  return {
    queryAll: vi.fn(() => []),
    execute: vi.fn(),
    transaction<T>(fn: () => T): T {
      return fn();
    },
  };
}

function makeSqliteDriver(opts: { materializerDb?: MaterializerDb | null } = {}): PlatformStorage {
  const driver = {
    exec: vi.fn(() => Promise.resolve()),
    prepare: vi.fn(() => ({
      all: vi.fn(() => Promise.resolve([])),
      get: vi.fn(() => Promise.resolve(undefined)),
      run: vi.fn(() => Promise.resolve()),
    })),
    transaction<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
    close: vi.fn(() => Promise.resolve()),
  };
  if (opts.materializerDb === null) return { backend: "sqlite-async" as const, driver };
  return {
    backend: "sqlite-sync" as const,
    driver,
    materializerDb: opts.materializerDb ?? makeMockMaterializerDb(),
  };
}

let mockPlatformStorage: PlatformStorage = makeSqliteDriver();

const mockSodium: PlatformContext["crypto"] = {
  memzero: vi.fn(),
  init: vi.fn(),
  isReady: vi.fn(() => true),
  constants: {} as PlatformContext["crypto"]["constants"],
  supportsSecureMemzero: false,
  aeadEncrypt: vi.fn(),
  aeadDecrypt: vi.fn(),
  aeadKeygen: vi.fn(),
  boxKeypair: vi.fn(),
  boxSeedKeypair: vi.fn(),
  boxEasy: vi.fn(),
  boxOpenEasy: vi.fn(),
  randomBytes: vi.fn(),
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
  memcmp: vi.fn(),
};

// ── Mocks ──────────────────────────────────────────────────────────

const mockBootstrap = vi.fn(() => Promise.resolve());
const mockDispose = vi.fn();
const mockGetDocumentSnapshot = vi.fn<(id: string) => unknown>(() => null);

const MockSyncEngine = vi.fn(function MockSyncEngineImpl(this: Record<string, unknown>) {
  this.bootstrap = mockBootstrap;
  this.dispose = mockDispose;
  this.getDocumentSnapshot = mockGetDocumentSnapshot;
});

const mockMaterialize = vi.fn();
const mockGetMaterializer = vi.fn<
  (docType: string) => { materialize: typeof mockMaterialize } | null
>(() => ({ materialize: mockMaterialize }));

const { mockSubscriberDispose } = vi.hoisted(() => ({ mockSubscriberDispose: vi.fn() }));

const mockKeyResolverDispose = vi.fn();
const MockDocumentKeyResolver = {
  create: vi.fn(() => ({ resolveKeys: vi.fn(), dispose: mockKeyResolverDispose })),
};

const mockClearAll = vi.fn();
const mockBucketKeyCache: BucketKeyCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(),
  clearAll: mockClearAll,
  size: 0,
  getByVersion: vi.fn(),
  setVersioned: vi.fn(),
  deleteVersion: vi.fn(),
};
const mockCreateBucketKeyCache = vi.fn((): BucketKeyCache => mockBucketKeyCache);

const MockSqliteStorageAdapter = {
  create: vi.fn((): Promise<unknown> => Promise.resolve({
    loadSnapshot: vi.fn(),
    saveSnapshot: vi.fn(),
    loadChanges: vi.fn(),
    appendChange: vi.fn(),
    pruneChanges: vi.fn(),
    listDocuments: vi.fn(() => []),
    deleteDocument: vi.fn(),
  })),
};

const mockWsConnect = vi.fn();
const mockWsDisconnect = vi.fn();
const mockWsGetAdapter = vi.fn(() => ({
  submitChange: vi.fn(),
  fetchChangesSince: vi.fn(),
  submitSnapshot: vi.fn(),
  fetchLatestSnapshot: vi.fn(),
  subscribe: vi.fn(),
  fetchManifest: vi.fn(),
  close: vi.fn(),
}));
const mockCreateWsManager = vi.fn(() => ({
  connect: mockWsConnect,
  disconnect: mockWsDisconnect,
  getSnapshot: vi.fn(() => "disconnected" as const),
  subscribe: vi.fn(() => vi.fn()),
  getAdapter: mockWsGetAdapter,
}));

let mockEventBus: import("@pluralscape/sync").EventBus<
  import("@pluralscape/sync").DataLayerEventMap
>;

vi.mock("../../auth/index.js", () => ({
  useAuth: (): AuthContextValue => ({
    snapshot: mockAuthState,
    login: vi.fn(),
    logout: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
  }),
}));
vi.mock("../../connection/index.js", () => ({
  useConnection: (): ConnectionContextValue => ({
    status: mockConnectionStatus,
    manager: {} as ConnectionContextValue["manager"],
  }),
}));
vi.mock("../../data/DataLayerProvider.js", () => ({
  useDataLayer: (): DataLayerContextValue => ({
    eventBus: mockEventBus,
    localDb: {} as DataLayerContextValue["localDb"],
  }),
}));
vi.mock("../../platform/index.js", () => ({
  usePlatform: (): PlatformContext => ({
    capabilities: {
      hasSecureStorage: false,
      hasBiometric: false,
      hasBackgroundSync: false,
      hasNativeMemzero: false,
      storageBackend: "sqlite",
    },
    storage: mockPlatformStorage,
    crypto: mockSodium,
  }),
}));
vi.mock("@pluralscape/sync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/sync")>();
  return { ...actual, SyncEngine: MockSyncEngine, DocumentKeyResolver: MockDocumentKeyResolver };
});
vi.mock("@pluralscape/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/crypto")>();
  return { ...actual, createBucketKeyCache: mockCreateBucketKeyCache };
});
vi.mock("@pluralscape/sync/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/sync/adapters")>();
  return { ...actual, SqliteStorageAdapter: MockSqliteStorageAdapter };
});
vi.mock("@pluralscape/sync/materializer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/sync/materializer")>();
  return { ...actual, getMaterializer: mockGetMaterializer };
});
vi.mock("@pluralscape/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/data")>();
  return {
    ...actual,
    createMaterializerSubscriber: (
      deps: Parameters<typeof actual.createMaterializerSubscriber>[0],
    ) => {
      const real = actual.createMaterializerSubscriber(deps);
      return {
        dispose: () => {
          mockSubscriberDispose();
          real.dispose();
        },
      };
    },
  };
});
vi.mock("../../connection/ws-manager.js", () => ({ createWsManager: mockCreateWsManager }));
vi.mock("../../config.js", () => ({ getWsUrl: () => "ws://localhost:3000/sync" }));

const { createEventBus } = await import("@pluralscape/sync");
const { SyncProvider, useSync } = await import("../SyncProvider.js");

function setUnlocked(): void {
  mockAuthState = {
    state: "unlocked",
    session: {
      credentials: {
        sessionToken: TEST_TOKEN,
        accountId: TEST_ACCOUNT_ID,
        systemId: TEST_SYSTEM_ID,
        salt: TEST_SALT,
      },
      masterKey: TEST_MASTER_KEY,
      identityKeys: { sign: TEST_SIGN_KEYS, box: TEST_BOX_KEYS },
    },
    credentials: {
      sessionToken: TEST_TOKEN,
      accountId: TEST_ACCOUNT_ID,
      systemId: TEST_SYSTEM_ID,
      salt: TEST_SALT,
    },
  };
}

function setUnauthenticated(): void {
  mockAuthState = { state: "unauthenticated", session: null, credentials: null };
}

function makeWrapper(): ({ children }: { readonly children: ReactNode }) => React.JSX.Element {
  return function Wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
    return <SyncProvider>{children}</SyncProvider>;
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe("SyncProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUnauthenticated();
    mockConnectionStatus = "disconnected";
    mockPlatformStorage = makeSqliteDriver();
    mockEventBus = createEventBus();
  });

  it("provides null engine and isBootstrapped:false when auth is unauthenticated", () => {
    const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });
    expect(result.current.engine).toBeNull();
    expect(result.current.isBootstrapped).toBe(false);
  });

  it("provides progress as null initially", () => {
    const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });
    expect(result.current.progress).toBeNull();
  });

  it("creates engine when auth is unlocked with sqlite platform", async () => {
    setUnlocked();
    mockConnectionStatus = "connected";

    const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(MockSyncEngine).toHaveBeenCalledTimes(1);
    });
    expect(MockSyncEngine).toHaveBeenCalledWith(
      expect.objectContaining({ systemId: TEST_SYSTEM_ID, sodium: mockSodium }),
    );

    expect(MockSqliteStorageAdapter.create).toHaveBeenCalledTimes(1);
    expect(MockDocumentKeyResolver.create).toHaveBeenCalledTimes(1);
    expect(mockCreateBucketKeyCache).toHaveBeenCalledTimes(1);
    expect(mockCreateWsManager).toHaveBeenCalledTimes(1);
    expect(mockWsConnect).toHaveBeenCalledWith(TEST_TOKEN, TEST_SYSTEM_ID);
    expect(result.current.engine).not.toBeNull();
  });

  it("does not create engine when platform storage is indexeddb", () => {
    setUnlocked();
    mockConnectionStatus = "connected";
    mockPlatformStorage = {
      backend: "indexeddb",
      storageAdapter: {} as PlatformStorage & { backend: "indexeddb" } extends {
        storageAdapter: infer T;
      }
        ? T
        : never,
      offlineQueueAdapter: {} as PlatformStorage & { backend: "indexeddb" } extends {
        offlineQueueAdapter: infer T;
      }
        ? T
        : never,
    };

    const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });

    expect(MockSyncEngine).not.toHaveBeenCalled();
    expect(result.current.engine).toBeNull();
  });

  it("selects owner-full profile for sqlite backend", async () => {
    setUnlocked();
    mockConnectionStatus = "connected";

    renderHook(() => useSync(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(MockSyncEngine).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: { profileType: "owner-full" } satisfies ReplicationProfile,
        }),
      );
    });
  });

  it("does not bootstrap when not connected", async () => {
    setUnlocked();
    mockConnectionStatus = "disconnected";

    renderHook(() => useSync(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(MockSyncEngine).toHaveBeenCalled();
    });
    expect(mockBootstrap).not.toHaveBeenCalled();
  });

  it("disposes engine on cleanup (unmount)", async () => {
    setUnlocked();
    mockConnectionStatus = "connected";

    const { unmount } = renderHook(() => useSync(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(MockSyncEngine).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(mockKeyResolverDispose).toHaveBeenCalledTimes(1);
    expect(mockClearAll).toHaveBeenCalledTimes(1);
    expect(mockWsDisconnect).toHaveBeenCalledTimes(1);
  });

  it("disposes engine when auth transitions to unauthenticated", async () => {
    setUnlocked();
    mockConnectionStatus = "connected";

    const { rerender } = renderHook(() => useSync(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(MockSyncEngine).toHaveBeenCalledTimes(1);
    });

    setUnauthenticated();
    mockConnectionStatus = "disconnected";

    rerender();

    expect(mockDispose).toHaveBeenCalled();
    expect(mockKeyResolverDispose).toHaveBeenCalled();
    expect(mockClearAll).toHaveBeenCalled();
    expect(mockWsDisconnect).toHaveBeenCalled();
  });

  it("passes eventBus to SyncEngine config", async () => {
    setUnlocked();
    mockConnectionStatus = "connected";

    renderHook(() => useSync(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(MockSyncEngine).toHaveBeenCalledWith(
        expect.objectContaining({ eventBus: mockEventBus }),
      );
    });
  });

  it("passes correct DocumentKeyResolver config", async () => {
    setUnlocked();
    mockConnectionStatus = "connected";

    renderHook(() => useSync(), { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(MockDocumentKeyResolver.create).toHaveBeenCalledWith({
        masterKey: TEST_MASTER_KEY,
        signingKeys: TEST_SIGN_KEYS,
        bucketKeyCache: mockBucketKeyCache,
        sodium: mockSodium,
      });
    });
  });

  it("throws when useSync is used outside SyncProvider", () => {
    expect(() => {
      renderHook(() => useSync());
    }).toThrow("useSync must be used within SyncProvider");
  });
});
