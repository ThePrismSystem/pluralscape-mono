// @vitest-environment happy-dom
import { brandId } from "@pluralscape/types";
import { act, renderHook, waitFor } from "@testing-library/react";
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
import type { AccountId, SyncDocumentId, SystemId } from "@pluralscape/types";
import type { ReactNode } from "react";

// ── Branded type helpers (assertion-based, no double-cast) ──────────

const KDF_MASTER_KEY_BYTES = 32;
const SIGN_PUBLIC_KEY_BYTES = 32;
const SIGN_SECRET_KEY_BYTES = 64;
const BOX_KEY_BYTES = 32;
const SALT_BYTES = 16;

function makeKdfMasterKey(): KdfMasterKey {
  const raw = new Uint8Array(KDF_MASTER_KEY_BYTES).fill(0x01);
  function assertKey(k: Uint8Array): asserts k is KdfMasterKey {
    if (k.length !== KDF_MASTER_KEY_BYTES) throw new Error("bad key");
  }
  assertKey(raw);
  return raw;
}

function makeSignKeypair(): SignKeypair {
  const pub = new Uint8Array(SIGN_PUBLIC_KEY_BYTES).fill(0x02);
  const sec = new Uint8Array(SIGN_SECRET_KEY_BYTES).fill(0x03);
  function assertPub(k: Uint8Array): asserts k is SignPublicKey {
    if (k.length !== SIGN_PUBLIC_KEY_BYTES) throw new Error("bad pub");
  }
  function assertSec(k: Uint8Array): asserts k is SignSecretKey {
    if (k.length !== SIGN_SECRET_KEY_BYTES) throw new Error("bad sec");
  }
  assertPub(pub);
  assertSec(sec);
  return { publicKey: pub, secretKey: sec };
}

function makeBoxKeypair(): BoxKeypair {
  const pub = new Uint8Array(BOX_KEY_BYTES).fill(0x04);
  const sec = new Uint8Array(BOX_KEY_BYTES).fill(0x05);
  function assertPub(k: Uint8Array): asserts k is BoxPublicKey {
    if (k.length !== BOX_KEY_BYTES) throw new Error("bad pub");
  }
  function assertSec(k: Uint8Array): asserts k is BoxSecretKey {
    if (k.length !== BOX_KEY_BYTES) throw new Error("bad sec");
  }
  assertPub(pub);
  assertSec(sec);
  return { publicKey: pub, secretKey: sec };
}

function makeSalt(): PwhashSalt {
  const raw = new Uint8Array(SALT_BYTES).fill(0x06);
  function assertSalt(k: Uint8Array): asserts k is PwhashSalt {
    if (k.length !== SALT_BYTES) throw new Error("bad salt");
  }
  assertSalt(raw);
  return raw;
}

function makeAccountId(s: string): AccountId {
  return brandId<AccountId>(s);
}

function makeSystemId(s: string): SystemId {
  return brandId<SystemId>(s);
}

// ── Test fixtures ───────────────────────────────────────────────────

const TEST_SYSTEM_ID = makeSystemId("sys_test123");
const TEST_ACCOUNT_ID = makeAccountId("acc_test");
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
  // Note: `transaction` is generic, so we use a regular method declaration
  // (preserves generic signature) rather than `vi.fn` (loses generic).
  return {
    queryAll: vi.fn(() => []),
    execute: vi.fn(),
    transaction<T>(fn: () => T): T {
      return fn();
    },
  };
}

function makeSqliteDriver(
  opts: {
    materializerDb?: MaterializerDb | null;
  } = {},
): PlatformStorage {
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
  // Default to "sqlite-sync" so existing tests that don't care about the
  // subscriber wiring still get a fully-typed PlatformStorage. Pass
  // `materializerDb: null` to opt into the async-only variant.
  if (opts.materializerDb === null) {
    return { backend: "sqlite-async" as const, driver };
  }
  return {
    backend: "sqlite-sync" as const,
    driver,
    materializerDb: opts.materializerDb ?? makeMockMaterializerDb(),
  };
}

let mockPlatformStorage: PlatformStorage = makeSqliteDriver();

// Mock SodiumAdapter — the provider passes this reference through without
// calling methods directly, so all methods are stubs.
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

// ── Mock SyncEngine ─────────────────────────────────────────────────

const mockBootstrap = vi.fn(() => Promise.resolve());
const mockDispose = vi.fn();
const mockGetDocumentSnapshot = vi.fn<(id: string) => unknown>(() => null);

// Use a function declaration so it can be called with `new`
const MockSyncEngine = vi.fn(function MockSyncEngineImpl(this: Record<string, unknown>) {
  this.bootstrap = mockBootstrap;
  this.dispose = mockDispose;
  this.getDocumentSnapshot = mockGetDocumentSnapshot;
});

// ── Mock materializer registry ──────────────────────────────────────

const mockMaterialize = vi.fn();
const mockGetMaterializer = vi.fn<
  (docType: string) => { materialize: typeof mockMaterialize } | null
>(() => ({
  materialize: mockMaterialize,
}));

// ── Hoisted subscriber-dispose spy (used by the disposal-order test) ──

const { mockSubscriberDispose } = vi.hoisted(() => ({
  mockSubscriberDispose: vi.fn(),
}));

// ── Mock DocumentKeyResolver ────────────────────────────────────────

const mockKeyResolverDispose = vi.fn();

const MockDocumentKeyResolver = {
  create: vi.fn(() => ({
    resolveKeys: vi.fn(),
    dispose: mockKeyResolverDispose,
  })),
};

// ── Mock BucketKeyCache ─────────────────────────────────────────────

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

const mockCreateBucketKeyCache = vi.fn(() => mockBucketKeyCache);

// ── Mock SqliteStorageAdapter ───────────────────────────────────────

const MockSqliteStorageAdapter = {
  create: vi.fn((): Promise<unknown> => {
    return Promise.resolve({
      loadSnapshot: vi.fn(),
      saveSnapshot: vi.fn(),
      loadChanges: vi.fn(),
      appendChange: vi.fn(),
      pruneChanges: vi.fn(),
      listDocuments: vi.fn(() => []),
      deleteDocument: vi.fn(),
    });
  }),
};

// ── Mock WsManager ──────────────────────────────────────────────────

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

// ── Mock event bus (real createEventBus from sync) ──────────────────

// We use a real event bus from @pluralscape/sync so event wiring works
// naturally. It is created per-test in beforeEach.
let mockEventBus: import("@pluralscape/sync").EventBus<
  import("@pluralscape/sync").DataLayerEventMap
>;

// ── Module mocks ────────────────────────────────────────────────────

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
  return {
    ...actual,
    SyncEngine: MockSyncEngine,
    DocumentKeyResolver: MockDocumentKeyResolver,
  };
});

vi.mock("@pluralscape/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/crypto")>();
  return {
    ...actual,
    createBucketKeyCache: mockCreateBucketKeyCache,
  };
});

vi.mock("@pluralscape/sync/adapters", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/sync/adapters")>();
  return {
    ...actual,
    SqliteStorageAdapter: MockSqliteStorageAdapter,
  };
});

vi.mock("@pluralscape/sync/materializer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pluralscape/sync/materializer")>();
  return {
    ...actual,
    getMaterializer: mockGetMaterializer,
  };
});

// Wrap createMaterializerSubscriber so we can observe its dispose timing
// against the engine's. The wrapper still delegates to the real subscriber so
// the existing "materializer subscriber wiring" tests keep exercising the
// real listener path.
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

vi.mock("../../connection/ws-manager.js", () => ({
  createWsManager: mockCreateWsManager,
}));

vi.mock("../../config.js", () => ({
  getWsUrl: () => "ws://localhost:3000/sync",
}));

// Dynamic import after all mocks
const { createEventBus } = await import("@pluralscape/sync");
const { SyncProvider, useSync } = await import("../SyncProvider.js");

// ── Test helpers ────────────────────────────────────────────────────

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
      identityKeys: {
        sign: TEST_SIGN_KEYS,
        box: TEST_BOX_KEYS,
      },
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
  mockAuthState = {
    state: "unauthenticated",
    session: null,
    credentials: null,
  };
}

function makeWrapper(): ({ children }: { readonly children: ReactNode }) => React.JSX.Element {
  return function Wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
    return <SyncProvider>{children}</SyncProvider>;
  };
}

// ── Tests ───────────────────────────────────────────────────────────

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

    // Wait for the async adapter factory to resolve and engine to wire up
    await waitFor(() => {
      expect(MockSyncEngine).toHaveBeenCalledTimes(1);
    });
    expect(MockSyncEngine).toHaveBeenCalledWith(
      expect.objectContaining({
        systemId: TEST_SYSTEM_ID,
        sodium: mockSodium,
      }),
    );

    // Adapters should be created
    expect(MockSqliteStorageAdapter.create).toHaveBeenCalledTimes(1);
    expect(MockDocumentKeyResolver.create).toHaveBeenCalledTimes(1);
    expect(mockCreateBucketKeyCache).toHaveBeenCalledTimes(1);
    expect(mockCreateWsManager).toHaveBeenCalledTimes(1);

    // WsManager should be connected
    expect(mockWsConnect).toHaveBeenCalledWith(TEST_TOKEN, TEST_SYSTEM_ID);

    // Engine should not be null in context
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

  it("bootstraps engine when connected and sets isBootstrapped", async () => {
    setUnlocked();
    mockConnectionStatus = "connected";

    const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });

    // Wait for async adapter/engine construction and bootstrap to complete
    await waitFor(() => {
      expect(mockBootstrap).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.isBootstrapped).toBe(true);
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

    // Simulate logout
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
        expect.objectContaining({
          eventBus: mockEventBus,
        }),
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

  describe("bootstrap error handling", () => {
    it("captures bootstrapError when bootstrap rejects with an Error", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";
      const bootError = new Error("storage init failed");
      mockBootstrap.mockImplementationOnce(() => Promise.reject(bootError));

      const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(result.current.bootstrapError).toEqual(bootError);
      });
      expect(result.current.bootstrapAttempts).toBe(1);
      expect(result.current.fallbackToRemote).toBe(false);
    });

    it("wraps non-Error rejection values in Error", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";
      // Build a rejected promise via PromiseConstructor.reject so the value
      // is preserved as a non-Error and exercises the
      // `err instanceof Error ? err : new Error(String(err))` branch.
      mockBootstrap.mockImplementationOnce(() => {
        const literal: unknown = "string failure";
        return Promise.reject(literal as Error);
      });

      const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(result.current.bootstrapError).toBeInstanceOf(Error);
      });
      expect(result.current.bootstrapError?.message).toBe("string failure");
    });

    it("falls back to remote after MAX_BOOTSTRAP_ATTEMPTS failures", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";
      mockBootstrap.mockImplementation(() => Promise.reject(new Error("permanent failure")));

      const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });

      // First attempt fails on initial mount
      await waitFor(() => {
        expect(result.current.bootstrapAttempts).toBe(1);
      });
      expect(result.current.fallbackToRemote).toBe(false);

      // Trigger retry — second attempt
      await act(() => {
        result.current.retryBootstrap();
        return Promise.resolve();
      });
      expect(result.current.bootstrapAttempts).toBe(2);
      expect(result.current.fallbackToRemote).toBe(false);

      // Third attempt — fallback should kick in
      await act(() => {
        result.current.retryBootstrap();
        return Promise.resolve();
      });
      expect(result.current.bootstrapAttempts).toBe(3);
      expect(result.current.fallbackToRemote).toBe(true);

      // Subsequent retries are no-ops while fallback is active
      const callsBefore = mockBootstrap.mock.calls.length;
      await act(() => {
        result.current.retryBootstrap();
        return Promise.resolve();
      });
      expect(mockBootstrap.mock.calls.length).toBe(callsBefore);
    });

    it("resets bootstrapError when retryBootstrap is called", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";
      mockBootstrap
        .mockImplementationOnce(() => Promise.reject(new Error("first")))
        .mockImplementationOnce(() => Promise.resolve());

      const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });
      await waitFor(() => {
        expect(result.current.bootstrapError?.message).toBe("first");
      });

      await act(() => {
        result.current.retryBootstrap();
        return Promise.resolve();
      });

      expect(result.current.bootstrapError).toBeNull();
      expect(result.current.isBootstrapped).toBe(true);
    });
  });

  describe("pipeline initialization", () => {
    it("cleans up resources when unmounted mid-adapter-creation", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      // Hold the adapter create() in a pending state so we can unmount first
      let resolveAdapter!: (value: unknown) => void;
      MockSqliteStorageAdapter.create.mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveAdapter = res;
          }),
      );

      const { unmount } = renderHook(() => useSync(), { wrapper: makeWrapper() });

      // Wait for IIFE to reach the awaiting-storage-adapter state
      await waitFor(() => {
        expect(MockSqliteStorageAdapter.create).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Resolve the adapter after unmount; cancellation branch should run
      resolveAdapter({
        loadSnapshot: vi.fn(),
        saveSnapshot: vi.fn(),
        loadChanges: vi.fn(),
        appendChange: vi.fn(),
        pruneChanges: vi.fn(),
        listDocuments: vi.fn(() => []),
        deleteDocument: vi.fn(),
      });
      await waitFor(() => {
        expect(mockClearAll).toHaveBeenCalledTimes(1);
      });

      // Engine never instantiated — cancellation caught the branch after await
      expect(MockSyncEngine).not.toHaveBeenCalled();
      // wsManager was not yet created, so disconnect should not be called
      expect(mockWsDisconnect).not.toHaveBeenCalled();
    });

    it("emits sync:error when storage-adapter initialization rejects", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      const initError = new Error("storage adapter create failed");
      MockSqliteStorageAdapter.create.mockRejectedValueOnce(initError);

      const emitted: import("@pluralscape/sync").SyncErrorEvent[] = [];
      mockEventBus.on("sync:error", (event) => {
        emitted.push(event);
      });

      const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(emitted).toHaveLength(1);
      });

      expect(emitted[0]?.message).toContain("initialization failed");
      expect(emitted[0]?.error).toBe(initError);
      expect(MockSyncEngine).not.toHaveBeenCalled();
      expect(result.current.engine).toBeNull();
    });
  });

  describe("materializer subscriber wiring", () => {
    it("invokes the materializer when sync:changes-merged fires after engine creation", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      const materializerDb = makeMockMaterializerDb();
      mockPlatformStorage = makeSqliteDriver({ materializerDb });

      // Snapshot returned for the document under test
      const docSnapshot = { members: { mem_1: { id: "mem_1", name: "Test" } } };
      mockGetDocumentSnapshot.mockReturnValue(docSnapshot);

      renderHook(() => useSync(), { wrapper: makeWrapper() });

      // Wait for the engine (and subscriber) to be wired
      await waitFor(() => {
        expect(MockSyncEngine).toHaveBeenCalledTimes(1);
      });

      // Emit sync:changes-merged on the same eventBus the provider passes to
      // the engine — the subscriber listens here.
      const docId = brandId<SyncDocumentId>("system-core_sys_test123");
      mockEventBus.emit("sync:changes-merged", {
        type: "sync:changes-merged",
        documentId: docId,
        documentType: "system-core",
        dirtyEntityTypes: new Set(["member"]),
        conflicts: [],
      });

      expect(mockGetDocumentSnapshot).toHaveBeenCalledWith(docId);
      expect(mockGetMaterializer).toHaveBeenCalledWith("system-core");
      expect(mockMaterialize).toHaveBeenCalledTimes(1);
      expect(mockMaterialize).toHaveBeenCalledWith(
        docSnapshot,
        materializerDb,
        mockEventBus,
        new Set(["member"]),
      );
    });

    it("invokes the materializer with no dirty filter on sync:snapshot-applied", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      const materializerDb = makeMockMaterializerDb();
      mockPlatformStorage = makeSqliteDriver({ materializerDb });
      const docSnapshot = { members: {} };
      mockGetDocumentSnapshot.mockReturnValue(docSnapshot);

      renderHook(() => useSync(), { wrapper: makeWrapper() });
      await waitFor(() => {
        expect(MockSyncEngine).toHaveBeenCalledTimes(1);
      });

      const docId = brandId<SyncDocumentId>("system-core_sys_test123");
      mockEventBus.emit("sync:snapshot-applied", {
        type: "sync:snapshot-applied",
        documentId: docId,
        documentType: "system-core",
      });

      expect(mockMaterialize).toHaveBeenCalledTimes(1);
      expect(mockMaterialize).toHaveBeenCalledWith(
        docSnapshot,
        materializerDb,
        mockEventBus,
        undefined,
      );
    });

    it("does not wire a subscriber when materializerDb is null", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      mockPlatformStorage = makeSqliteDriver({ materializerDb: null });
      mockGetDocumentSnapshot.mockReturnValue({ members: {} });

      renderHook(() => useSync(), { wrapper: makeWrapper() });
      await waitFor(() => {
        expect(MockSyncEngine).toHaveBeenCalledTimes(1);
      });

      mockEventBus.emit("sync:changes-merged", {
        type: "sync:changes-merged",
        documentId: brandId<SyncDocumentId>("system-core_sys_test123"),
        documentType: "system-core",
        dirtyEntityTypes: new Set(["member"]),
        conflicts: [],
      });

      expect(mockMaterialize).not.toHaveBeenCalled();
    });

    it("disposes the subscriber on unmount so later events are ignored", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      mockPlatformStorage = makeSqliteDriver({ materializerDb: makeMockMaterializerDb() });
      mockGetDocumentSnapshot.mockReturnValue({ members: {} });

      const { unmount } = renderHook(() => useSync(), { wrapper: makeWrapper() });
      await waitFor(() => {
        expect(MockSyncEngine).toHaveBeenCalledTimes(1);
      });

      unmount();

      mockEventBus.emit("sync:changes-merged", {
        type: "sync:changes-merged",
        documentId: brandId<SyncDocumentId>("system-core_sys_test123"),
        documentType: "system-core",
        dirtyEntityTypes: new Set(["member"]),
        conflicts: [],
      });

      expect(mockMaterialize).not.toHaveBeenCalled();
    });

    it("disposes the subscriber before the engine on unmount", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      mockPlatformStorage = makeSqliteDriver({ materializerDb: makeMockMaterializerDb() });

      const { unmount } = renderHook(() => useSync(), { wrapper: makeWrapper() });
      await waitFor(() => {
        expect(MockSyncEngine).toHaveBeenCalledTimes(1);
      });

      unmount();

      const subscriberOrder = mockSubscriberDispose.mock.invocationCallOrder[0];
      const engineOrder = mockDispose.mock.invocationCallOrder[0];
      // Vitest invocation order is monotonic and starts at 1; missing entries
      // are undefined. Asserting > 0 doubles as a "was actually called" check.
      expect(subscriberOrder).toBeGreaterThan(0);
      expect(engineOrder).toBeGreaterThan(0);
      // Subscriber must stop consuming events before the engine stops emitting.
      expect(subscriberOrder).toBeLessThan(engineOrder ?? 0);
    });

    it("creates a fresh subscriber on lock→unlock cycle", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      mockPlatformStorage = makeSqliteDriver({ materializerDb: makeMockMaterializerDb() });

      const { rerender } = renderHook(() => useSync(), { wrapper: makeWrapper() });
      await waitFor(() => {
        expect(MockSyncEngine).toHaveBeenCalledTimes(1);
      });
      expect(mockSubscriberDispose).not.toHaveBeenCalled();

      // Lock — the subscriber for the first session must be disposed.
      setUnauthenticated();
      mockConnectionStatus = "disconnected";
      rerender();

      await waitFor(() => {
        expect(mockSubscriberDispose).toHaveBeenCalledTimes(1);
      });

      // Unlock again — a NEW engine and subscriber are constructed.
      setUnlocked();
      mockConnectionStatus = "connected";
      mockPlatformStorage = makeSqliteDriver({ materializerDb: makeMockMaterializerDb() });
      rerender();

      await waitFor(() => {
        expect(MockSyncEngine).toHaveBeenCalledTimes(2);
      });
    });

    it("clears engine state when SyncEngine construction throws", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      const constructError = new Error("engine ctor failed");
      MockSyncEngine.mockImplementationOnce(function FailingCtor() {
        throw constructError;
      });

      const emitted: import("@pluralscape/sync").SyncErrorEvent[] = [];
      mockEventBus.on("sync:error", (event) => {
        emitted.push(event);
      });

      const { result } = renderHook(() => useSync(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(emitted).toHaveLength(1);
      });

      expect(emitted[0]?.message).toContain("initialization failed");
      expect(emitted[0]?.error).toBe(constructError);
      expect(result.current.engine).toBeNull();
      expect(result.current.isBootstrapped).toBe(false);
      // Resources created BEFORE the throw must be torn down.
      expect(mockKeyResolverDispose).toHaveBeenCalledTimes(1);
      expect(mockClearAll).toHaveBeenCalledTimes(1);
      expect(mockWsDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
