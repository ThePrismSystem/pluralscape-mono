import { createBucketKeyCache } from "@pluralscape/crypto";
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
import type { DataLayerEventMap, EventBus, ReplicationProfile } from "@pluralscape/sync";
import type { SqliteDriver } from "@pluralscape/sync/adapters";
import type { SystemId } from "@pluralscape/types";
import type { ReactNode } from "react";

export type { SyncContextValue, SyncProgress } from "./sync-context.js";
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
 * WsManager (WebSocket network adapter), and SyncEngine.
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
    };
    // storageBackend intentionally excluded: sqliteDriver is null on non-sqlite
    // platforms, so the null check above already gates on backend type.
  }, [isUnlocked, systemId, sodium, eventBus, sessionToken, masterKey, signingKeys, sqliteDriver]);

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

    // Create sync pipeline resources
    const bucketKeyCache = createBucketKeyCache();
    bucketKeyCacheRef.current = bucketKeyCache;

    const storageAdapter = new SqliteStorageAdapter(engineConfig.sqliteDriver);

    const keyResolver = DocumentKeyResolver.create({
      masterKey: engineConfig.masterKey,
      signingKeys: engineConfig.signingKeys,
      bucketKeyCache,
      sodium: engineConfig.sodium,
    });
    keyResolverRef.current = keyResolver;

    const wsManager = createWsManager({
      url: getWsUrl(),
      eventBus: engineConfig.eventBus,
    });
    wsManagerRef.current = wsManager;
    wsManager.connect(engineConfig.sessionToken, engineConfig.systemId);

    const networkAdapter = wsManager.getAdapter();
    if (networkAdapter === null) {
      // Should not happen since connect() sets it synchronously, but guard
      return;
    }

    const profile: ReplicationProfile = { profileType: "owner-full" };

    // Create SyncEngine — errors are emitted via the event bus
    const bus = engineConfig.eventBus;
    const newEngine = new SyncEngine({
      networkAdapter,
      storageAdapter,
      keyResolver,
      sodium: engineConfig.sodium,
      profile,
      systemId: engineConfig.systemId,
      onError: (message, error) => {
        bus.emit("sync:error", { type: "sync:error", message, error });
      },
      eventBus: bus,
    });
    setEngine(newEngine);

    return () => {
      newEngine.dispose();
      setEngine(null);
      keyResolver.dispose();
      keyResolverRef.current = null;
      bucketKeyCache.clearAll();
      bucketKeyCacheRef.current = null;
      wsManager.disconnect();
      wsManagerRef.current = null;
      setIsBootstrapped(false);
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
