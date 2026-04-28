import { createBucketKeyCache } from "@pluralscape/crypto";
import { createMaterializerSubscriber } from "@pluralscape/data";
import { DocumentKeyResolver, SyncEngine } from "@pluralscape/sync";
import { SqliteStorageAdapter } from "@pluralscape/sync/adapters";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../auth/index.js";
import { getWsUrl } from "../config.js";
import { useConnection } from "../connection/index.js";
import { createWsManager } from "../connection/ws-manager.js";
import { useDataLayer } from "../data/DataLayerProvider.js";
import { usePlatform } from "../platform/index.js";

import { SyncCtx } from "./sync-context.js";

import type { SyncContextValue } from "./sync-context.js";
import type { WsManager } from "../connection/ws-manager.js";
import type { BucketKeyCache, KdfMasterKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";
import type { MaterializerSubscriberHandle } from "@pluralscape/data";
import type { DataLayerEventMap, EventBus, ReplicationProfile } from "@pluralscape/sync";
import type { SqliteDriver } from "@pluralscape/sync/adapters";
import type { MaterializerDb } from "@pluralscape/sync/materializer";
import type { SystemId } from "@pluralscape/types";
import type { ReactNode } from "react";

export { SyncCtx, useSync } from "./sync-context.js";

/** Maximum number of bootstrap attempts before falling back to remote. */
const MAX_BOOTSTRAP_ATTEMPTS = 3;

/** Extracted config when all prerequisites for engine creation are met. */
interface EngineReadyConfig {
  readonly systemId: SystemId;
  readonly sodium: SodiumAdapter;
  readonly eventBus: EventBus<DataLayerEventMap>;
  readonly sessionToken: string;
  readonly masterKey: KdfMasterKey;
  readonly signingKeys: SignKeypair;
  readonly sqliteDriver: SqliteDriver;
  /**
   * Synchronous materializer DB handle. `null` on backends that only expose
   * async APIs (web/OPFS); the subscriber is skipped in that case.
   */
  readonly materializerDb: MaterializerDb | null;
}

const Ctx = SyncCtx;

/**
 * Wires the SyncEngine to the event bus and upstream providers.
 *
 * Creates the full sync pipeline when:
 * 1. Auth state reaches "unlocked" (session with master key available)
 * 2. Platform storage backend is "sqlite" (full device)
 *
 * Constructs: SqliteStorageAdapter, DocumentKeyResolver (with BucketKeyCache),
 * WsManager (WebSocket network adapter), SyncEngine, and (when the platform
 * exposes a synchronous DB handle) the materializer subscriber that projects
 * merged CRDT state into local SQLite cache tables.
 *
 * Bootstraps sync when the SSE connection reports "connected", then exposes
 * engine and bootstrap state via context. Retries up to MAX_BOOTSTRAP_ATTEMPTS
 * times on failure before falling back to remote-only mode.
 *
 * Disposes all resources on auth state transitions (lock/logout) or unmount.
 */
export function SyncProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const auth = useAuth();
  const { eventBus } = useDataLayer();
  const platform = usePlatform();
  const connection = useConnection();

  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);
  const [bootstrapAttempts, setBootstrapAttempts] = useState(0);
  const [fallbackToRemote, setFallbackToRemote] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  // Refs for resources that need cleanup but don't drive renders
  const wsManagerRef = useRef<WsManager | null>(null);
  const keyResolverRef = useRef<DocumentKeyResolver | null>(null);
  const bucketKeyCacheRef = useRef<BucketKeyCache | null>(null);

  const retryBootstrap = useCallback(() => {
    setBootstrapError(null);
    setRetryNonce((n) => n + 1);
  }, []);

  // Derive readiness from auth state — sync requires an unlocked session
  const isUnlocked = auth.snapshot.state === "unlocked";
  const systemId = auth.snapshot.credentials?.systemId ?? null;
  const sodium = platform.crypto;
  const isConnected = connection.status === "connected";

  // Extract stable primitives for the memo — avoids re-firing the effect
  // when hook wrappers return fresh container objects on each render.
  const sessionToken =
    auth.snapshot.state === "unlocked" ? auth.snapshot.credentials.sessionToken : null;
  const masterKey = auth.snapshot.state === "unlocked" ? auth.snapshot.session.masterKey : null;
  const signingKeys =
    auth.snapshot.state === "unlocked" ? auth.snapshot.session.identityKeys.sign : null;
  const sqliteDriver = platform.storage.backend === "sqlite" ? platform.storage.driver : null;
  const materializerDb =
    platform.storage.backend === "sqlite" ? platform.storage.materializerDb : null;

  // Memoize engine creation config — excludes isConnected to avoid tearing
  // down and re-creating the engine on every connection status change.
  const engineConfig = useMemo<EngineReadyConfig | null>(() => {
    if (
      !isUnlocked ||
      systemId === null ||
      sessionToken === null ||
      masterKey === null ||
      signingKeys === null ||
      sqliteDriver === null
    ) {
      return null;
    }

    return {
      systemId,
      sodium,
      eventBus,
      sessionToken,
      masterKey,
      signingKeys,
      sqliteDriver,
      materializerDb,
    };
    // storageBackend intentionally excluded: sqliteDriver is null on non-sqlite
    // platforms, so the null check above already gates on backend type.
  }, [
    isUnlocked,
    systemId,
    sodium,
    eventBus,
    sessionToken,
    masterKey,
    signingKeys,
    sqliteDriver,
    materializerDb,
  ]);

  // Engine lifecycle effect — creates or tears down the sync pipeline.
  // Uses a ref-based cleanup strategy so state updates in the effect body
  // don't cause the memo/effect to re-evaluate spuriously.
  useEffect(() => {
    if (engineConfig === null) {
      // Auth not ready or wrong platform — tear down any existing resources
      setEngine((prev) => {
        prev?.dispose();
        return null;
      });
      if (keyResolverRef.current !== null) {
        keyResolverRef.current.dispose();
        keyResolverRef.current = null;
      }
      if (bucketKeyCacheRef.current !== null) {
        bucketKeyCacheRef.current.clearAll();
        bucketKeyCacheRef.current = null;
      }
      if (wsManagerRef.current !== null) {
        wsManagerRef.current.disconnect();
        wsManagerRef.current = null;
      }
      setIsBootstrapped(false);
      return;
    }

    // Create sync pipeline resources. The SQLite storage adapter is constructed
    // via an async factory (OPFS backends need to initialize a worker), so we
    // wrap the pipeline construction in an IIFE and guard each await boundary
    // with a cancellation check to handle teardown during initialization.
    // `isCancelled` is a getter function so TypeScript's control-flow analysis
    // does not narrow the backing flag to `false` at each check across the
    // await boundaries.
    const state: { cancelled: boolean } = { cancelled: false };
    const isCancelled = (): boolean => state.cancelled;
    let cleanup: (() => void) | null = null;

    const pipeline: {
      bucketKeyCache?: ReturnType<typeof createBucketKeyCache>;
      keyResolver?: DocumentKeyResolver;
      wsManager?: WsManager;
      engine?: SyncEngine;
      materializerSubscriber?: MaterializerSubscriberHandle;
    } = {};

    const disposePartial = (): void => {
      // Tear down in reverse construction order. Subscriber first so it
      // stops consuming events the engine is about to stop emitting.
      pipeline.materializerSubscriber?.dispose();
      pipeline.engine?.dispose();
      pipeline.keyResolver?.dispose();
      pipeline.wsManager?.disconnect();
      pipeline.bucketKeyCache?.clearAll();
      bucketKeyCacheRef.current = null;
      keyResolverRef.current = null;
      wsManagerRef.current = null;
    };

    void (async () => {
      try {
        pipeline.bucketKeyCache = createBucketKeyCache();
        bucketKeyCacheRef.current = pipeline.bucketKeyCache;

        const storageAdapter = await SqliteStorageAdapter.create(engineConfig.sqliteDriver);
        if (isCancelled()) {
          disposePartial();
          return;
        }

        pipeline.keyResolver = DocumentKeyResolver.create({
          masterKey: engineConfig.masterKey,
          signingKeys: engineConfig.signingKeys,
          bucketKeyCache: pipeline.bucketKeyCache,
          sodium: engineConfig.sodium,
        });
        keyResolverRef.current = pipeline.keyResolver;

        pipeline.wsManager = createWsManager({
          url: getWsUrl(),
          eventBus: engineConfig.eventBus,
        });
        wsManagerRef.current = pipeline.wsManager;
        pipeline.wsManager.connect(engineConfig.sessionToken, engineConfig.systemId);

        const networkAdapter = pipeline.wsManager.getAdapter();
        if (networkAdapter === null || isCancelled()) {
          disposePartial();
          return;
        }

        const profile: ReplicationProfile = { profileType: "owner-full" };

        const bus = engineConfig.eventBus;
        pipeline.engine = new SyncEngine({
          networkAdapter,
          storageAdapter,
          keyResolver: pipeline.keyResolver,
          sodium: engineConfig.sodium,
          profile,
          systemId: engineConfig.systemId,
          onError: (message, error) => {
            bus.emit("sync:error", { type: "sync:error", message, error });
          },
          eventBus: bus,
        });
        if (isCancelled()) {
          disposePartial();
          return;
        }

        // Wire the materializer subscriber once the engine exists, so merged
        // CRDT state lands in the local SQLite cache. Skipped when the
        // platform doesn't expose a synchronous DB handle (web/OPFS).
        if (engineConfig.materializerDb !== null) {
          pipeline.materializerSubscriber = createMaterializerSubscriber({
            engine: pipeline.engine,
            materializerDb: engineConfig.materializerDb,
            eventBus: bus,
          });
        }

        setEngine(pipeline.engine);

        cleanup = () => {
          disposePartial();
          setEngine(null);
          setIsBootstrapped(false);
        };
      } catch (error) {
        engineConfig.eventBus.emit("sync:error", {
          type: "sync:error",
          message: "Sync pipeline initialization failed",
          error,
        });
        disposePartial();
      }
    })();

    return () => {
      state.cancelled = true;
      cleanup?.();
    };
  }, [engineConfig]);

  // Bootstrap effect — runs when connection becomes available after engine creation.
  // Retries are triggered via retryNonce. Falls back to remote after MAX_BOOTSTRAP_ATTEMPTS.
  // Uses a cancelled flag to guard against React dev-mode double-invocation.
  useEffect(() => {
    if (engine === null || !isConnected || isBootstrapped || fallbackToRemote) {
      return;
    }

    let cancelled = false;
    const bus = eventBus;
    engine
      .bootstrap()
      .then(() => {
        if (!cancelled) {
          setIsBootstrapped(true);
          setBootstrapError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          bus.emit("sync:error", {
            type: "sync:error",
            message: "Bootstrap failed",
            error,
          });
          setBootstrapError(error);
          setBootstrapAttempts((prev) => {
            const next = prev + 1;
            if (next >= MAX_BOOTSTRAP_ATTEMPTS) {
              setFallbackToRemote(true);
            }
            return next;
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [engine, isConnected, isBootstrapped, fallbackToRemote, eventBus, retryNonce]);

  const value = useMemo<SyncContextValue>(
    () => ({
      engine,
      isBootstrapped,
      progress: null,
      bootstrapError,
      bootstrapAttempts,
      retryBootstrap,
      fallbackToRemote,
    }),
    [engine, isBootstrapped, bootstrapError, bootstrapAttempts, retryBootstrap, fallbackToRemote],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
