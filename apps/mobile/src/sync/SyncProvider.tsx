import { createBucketKeyCache } from "@pluralscape/crypto";
import { DocumentKeyResolver, SyncEngine } from "@pluralscape/sync";
import { SqliteStorageAdapter } from "@pluralscape/sync/adapters";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../auth/index.js";
import { getWsUrl } from "../config.js";
import { useConnection } from "../connection/index.js";
import { createWsManager } from "../connection/ws-manager.js";
import { useDataLayer } from "../data/DataLayerProvider.js";
import { usePlatform } from "../platform/index.js";

import type { WsManager } from "../connection/ws-manager.js";
import type { BucketKeyCache, KdfMasterKey, SignKeypair, SodiumAdapter } from "@pluralscape/crypto";
import type { DataLayerEventMap, EventBus, ReplicationProfile } from "@pluralscape/sync";
import type { SqliteDriver } from "@pluralscape/sync/adapters";
import type { SystemId } from "@pluralscape/types";
import type { ReactNode } from "react";

export interface SyncContextValue {
  readonly engine: SyncEngine | null;
  readonly isBootstrapped: boolean;
  readonly progress: { synced: number; total: number } | null;
}

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

const Ctx = createContext<SyncContextValue | null>(null);

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
 * engine and bootstrap state via context.
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

  // Refs for resources that need cleanup but don't drive renders
  const wsManagerRef = useRef<WsManager | null>(null);
  const keyResolverRef = useRef<DocumentKeyResolver | null>(null);
  const bucketKeyCacheRef = useRef<BucketKeyCache | null>(null);

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
  const storageBackend = platform.storage.backend;
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
  }, [
    isUnlocked,
    systemId,
    sodium,
    eventBus,
    sessionToken,
    masterKey,
    signingKeys,
    sqliteDriver,
    storageBackend,
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

    // 1. Create BucketKeyCache
    const bucketKeyCache = createBucketKeyCache();
    bucketKeyCacheRef.current = bucketKeyCache;

    // 2. Create SqliteStorageAdapter from platform driver
    const storageAdapter = new SqliteStorageAdapter(engineConfig.sqliteDriver);

    // 3. Create DocumentKeyResolver
    const keyResolver = DocumentKeyResolver.create({
      masterKey: engineConfig.masterKey,
      signingKeys: engineConfig.signingKeys,
      bucketKeyCache,
      sodium: engineConfig.sodium,
    });
    keyResolverRef.current = keyResolver;

    // 4. Create WsManager and connect
    const wsManager = createWsManager({
      url: getWsUrl(),
      eventBus: engineConfig.eventBus,
    });
    wsManagerRef.current = wsManager;
    wsManager.connect(engineConfig.sessionToken, engineConfig.systemId);

    // 5. Get network adapter from WsManager (available immediately after connect)
    const networkAdapter = wsManager.getAdapter();
    if (networkAdapter === null) {
      // Should not happen since connect() sets it synchronously, but guard
      return;
    }

    // 6. Select replication profile based on storage backend
    const profile: ReplicationProfile = { profileType: "owner-full" };

    // 7. Create SyncEngine — errors are emitted via the event bus
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
  // Uses a cancelled flag to guard against React dev-mode double-invocation.
  useEffect(() => {
    if (engine === null || !isConnected || isBootstrapped) {
      return;
    }

    let cancelled = false;
    const bus = eventBus;
    engine
      .bootstrap()
      .then(() => {
        if (!cancelled) {
          setIsBootstrapped(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          bus.emit("sync:error", {
            type: "sync:error",
            message: "Bootstrap failed",
            error,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [engine, isConnected, isBootstrapped, eventBus]);

  const value = useMemo<SyncContextValue>(
    () => ({
      engine,
      isBootstrapped,
      progress: null,
    }),
    [engine, isBootstrapped],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}
