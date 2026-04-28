import { useDataLayerOptional } from "../data/DataLayerProvider.js";
import { usePlatform } from "../platform/PlatformProvider.js";
import { isSqliteBackend } from "../platform/types.js";
import { useSync } from "../sync/sync-context.js";

import type { LocalDatabase } from "../data/local-database.js";

export type QuerySource = "local" | "remote";

/**
 * Returns the read path for data hooks: "local" when SQLite is initialized
 * and sync has bootstrapped, "remote" otherwise (tRPC).
 */
export function useQuerySource(): QuerySource {
  const platform = usePlatform();
  const sync = useSync();
  if (sync.fallbackToRemote) return "remote";
  return isSqliteBackend(platform.storage) && sync.isBootstrapped ? "local" : "remote";
}

/**
 * Local-mode real-time update note:
 *
 * When the query source is "local", real-time updates are handled by the
 * sync engine → event bus → QueryInvalidator pipeline. tRPC subscriptions
 * are disabled in local mode since the sync engine pushes changes directly.
 */

/**
 * Returns the local SQLite database when the DataLayer context is available,
 * null otherwise (non-sqlite platforms or before provider mounts).
 */
export function useLocalDb(): LocalDatabase | null {
  const ctx = useDataLayerOptional();
  return ctx?.localDb ?? null;
}
