import type { SodiumAdapter } from "@pluralscape/crypto";
import type {
  SqliteDriver,
  SyncStorageAdapter,
  OfflineQueueAdapter,
} from "@pluralscape/sync/adapters";
import type { MaterializerDb } from "@pluralscape/sync/materializer";

export type StorageBackend = "sqlite" | "indexeddb";

export interface PlatformCapabilities {
  readonly hasSecureStorage: boolean;
  readonly hasBiometric: boolean;
  readonly hasBackgroundSync: boolean;
  readonly hasNativeMemzero: boolean;
  readonly storageBackend: StorageBackend;
  /** Populated when OPFS was available but init failed, causing IndexedDB fallback. */
  readonly storageFallbackReason?: string;
}

export type PlatformStorage =
  | {
      /**
       * Native sqlite (expo-sqlite). Exposes both the async {@link SqliteDriver}
       * used by the engine's storage adapter and the synchronous
       * {@link MaterializerDb} the materializer subscriber writes through.
       */
      readonly backend: "sqlite-sync";
      readonly driver: SqliteDriver;
      readonly materializerDb: MaterializerDb;
    }
  | {
      /**
       * Web sqlite (OPFS over a Worker). Only exposes async APIs; no
       * materializer subscriber wires up on this backend until a sync path
       * lands (e.g. wa-sqlite synchronous mode).
       */
      readonly backend: "sqlite-async";
      readonly driver: SqliteDriver;
    }
  | {
      readonly backend: "indexeddb";
      readonly storageAdapter: SyncStorageAdapter;
      readonly offlineQueueAdapter: OfflineQueueAdapter;
    };

/**
 * Type guard covering both sqlite variants (native sync + OPFS async). Use
 * when consumers only need a {@link SqliteDriver} and don't care which
 * platform produced it.
 */
export function isSqliteBackend(
  s: PlatformStorage,
): s is PlatformStorage & { driver: SqliteDriver } {
  return s.backend === "sqlite-sync" || s.backend === "sqlite-async";
}

export interface PlatformContext {
  readonly capabilities: PlatformCapabilities;
  readonly storage: PlatformStorage;
  readonly crypto: SodiumAdapter;
}
