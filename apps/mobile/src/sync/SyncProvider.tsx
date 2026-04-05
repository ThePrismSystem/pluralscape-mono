import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../auth/index.js";
import { useConnection } from "../connection/index.js";
import { useDataLayer } from "../data/DataLayerProvider.js";
import { usePlatform } from "../platform/index.js";

import type { SyncEngine } from "@pluralscape/sync";
import type { ReactNode } from "react";

export interface SyncContextValue {
  readonly engine: SyncEngine | null;
  readonly isBootstrapped: boolean;
}

const Ctx = createContext<SyncContextValue | null>(null);

/**
 * Wires the SyncEngine to the event bus and upstream providers.
 *
 * Currently creates no engine — the required adapters (SyncNetworkAdapter,
 * SyncStorageAdapter, DocumentKeyResolver) are not yet instantiated in the
 * mobile provider tree. Once they are, the engine will be constructed here
 * when the user reaches the "unlocked" auth state.
 *
 * What IS wired today:
 * - Auth state detection (unlocked = ready to sync)
 * - Event bus reference from DataLayerProvider
 * - SodiumAdapter from PlatformProvider
 * - Connection status awareness
 * - SystemId extraction from auth credentials
 * - Cleanup on auth state transitions (logout/lock)
 *
 * TODO: To complete the sync pipeline, the following must be provided:
 * 1. SyncNetworkAdapter — wrap the WsClientAdapter from ws-manager or expose
 *    it via ConnectionProvider so the SyncEngine can issue protocol requests
 * 2. SyncStorageAdapter — instantiate SqliteStorageAdapter with the platform
 *    sqlite driver (or use platform.storage.storageAdapter for IndexedDB)
 * 3. DocumentKeyResolver — requires a BucketKeyCache instance, which needs
 *    bucket key grant fetching/caching infrastructure
 * 4. ReplicationProfile — determine profile type from device capabilities
 *    and user preferences (owner-full vs owner-lite)
 */
export function SyncProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const auth = useAuth();
  const { eventBus } = useDataLayer();
  const platform = usePlatform();
  const connection = useConnection();

  const engineRef = useRef<SyncEngine | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState(false);

  // Derive readiness from auth state — sync requires an unlocked session
  const isUnlocked = auth.snapshot.state === "unlocked";
  const systemId = auth.snapshot.credentials?.systemId ?? null;
  const sodium = platform.crypto;

  // Track whether connection is usable for sync bootstrap
  const isConnected = connection.status === "connected";

  // Memoize the available config to avoid spurious effect re-runs
  const availableConfig = useMemo(
    () => (isUnlocked && systemId !== null ? { systemId, sodium, eventBus, isConnected } : null),
    [isUnlocked, systemId, sodium, eventBus, isConnected],
  );

  useEffect(() => {
    if (availableConfig === null) {
      // Auth not ready — tear down any existing engine
      if (engineRef.current !== null) {
        engineRef.current.dispose();
        engineRef.current = null;
        setIsBootstrapped(false);
      }
      return;
    }

    // TODO: Create SyncEngine once adapters are available:
    //
    // const storageAdapter = new SqliteStorageAdapter(sqliteDriver);
    // const keyResolver = DocumentKeyResolver.create({
    //   masterKey: auth.snapshot.session.masterKey,
    //   signingKeys: auth.snapshot.session.identityKeys.sign,
    //   bucketKeyCache,
    //   sodium: availableConfig.sodium,
    // });
    // const networkAdapter = /* WsClientAdapter from connection layer */;
    // const profile: ReplicationProfile = { profileType: "owner-full" };
    //
    // const engine = new SyncEngine({
    //   networkAdapter,
    //   storageAdapter,
    //   keyResolver,
    //   sodium: availableConfig.sodium,
    //   profile,
    //   systemId: availableConfig.systemId,
    //   onError: (message, error) => console.error(`[SyncEngine] ${message}`, error),
    //   eventBus: availableConfig.eventBus,
    // });
    //
    // engineRef.current = engine;
    //
    // if (availableConfig.isConnected) {
    //   engine.bootstrap().then(() => setIsBootstrapped(true));
    // }

    return () => {
      if (engineRef.current !== null) {
        engineRef.current.dispose();
        engineRef.current = null;
        setIsBootstrapped(false);
      }
    };
  }, [availableConfig]);

  const value = useMemo<SyncContextValue>(
    () => ({
      engine: engineRef.current,
      isBootstrapped,
    }),
    // engineRef.current changes are captured via isBootstrapped state updates
    [isBootstrapped],
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
