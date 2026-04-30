/**
 * SyncProvider pipeline initialization and materializer subscriber wiring tests.
 *
 * Covers: mid-adapter-creation cleanup, storage-adapter rejection, materializer
 *         event wiring, subscriber disposal ordering, lock→unlock cycle,
 *         engine construction failure
 * Companion file: SyncProvider-lifecycle.test.tsx
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

// ── Hoisted subscriber-dispose spy ──────────────────────────────────

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

// ── Mock event bus ──────────────────────────────────────────────────

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

  describe("pipeline initialization", () => {
    it("cleans up resources when unmounted mid-adapter-creation", async () => {
      setUnlocked();
      mockConnectionStatus = "connected";

      let resolveAdapter!: (value: unknown) => void;
      MockSqliteStorageAdapter.create.mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveAdapter = res;
          }),
      );

      const { unmount } = renderHook(() => useSync(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(MockSqliteStorageAdapter.create).toHaveBeenCalledTimes(1);
      });

      unmount();

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

      expect(MockSyncEngine).not.toHaveBeenCalled();
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

      const docSnapshot = { members: { mem_1: { id: "mem_1", name: "Test" } } };
      mockGetDocumentSnapshot.mockReturnValue(docSnapshot);

      renderHook(() => useSync(), { wrapper: makeWrapper() });

      await waitFor(() => {
        expect(MockSyncEngine).toHaveBeenCalledTimes(1);
      });

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
      expect(subscriberOrder).toBeGreaterThan(0);
      expect(engineOrder).toBeGreaterThan(0);
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

      setUnauthenticated();
      mockConnectionStatus = "disconnected";
      rerender();

      await waitFor(() => {
        expect(mockSubscriberDispose).toHaveBeenCalledTimes(1);
      });

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
      expect(mockKeyResolverDispose).toHaveBeenCalledTimes(1);
      expect(mockClearAll).toHaveBeenCalledTimes(1);
      expect(mockWsDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
