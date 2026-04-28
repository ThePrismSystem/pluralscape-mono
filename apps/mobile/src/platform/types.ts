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
      readonly backend: "sqlite";
      readonly driver: SqliteDriver;
      /**
       * Synchronous DB handle the materializer subscriber writes through.
       * Populated for sync-native backends (expo-sqlite); `null` for backends
       * that only expose async APIs (OPFS over a Web Worker).
       */
      readonly materializerDb: MaterializerDb | null;
    }
  | {
      readonly backend: "indexeddb";
      readonly storageAdapter: SyncStorageAdapter;
      readonly offlineQueueAdapter: OfflineQueueAdapter;
    };

export interface PlatformContext {
  readonly capabilities: PlatformCapabilities;
  readonly storage: PlatformStorage;
  readonly crypto: SodiumAdapter;
}
