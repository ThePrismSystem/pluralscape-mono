import { createContext, useContext } from "react";

import type { SyncEngine } from "@pluralscape/sync";

export interface SyncContextValue {
  readonly engine: SyncEngine | null;
  readonly isBootstrapped: boolean;
  readonly progress: { synced: number; total: number } | null;
}

/**
 * Raw React context for sync state.
 *
 * Exported separately from SyncProvider to allow test helpers to inject
 * a stub value without importing the full SyncProvider module (which
 * transitively pulls in expo-constants via config.ts).
 */
export const SyncCtx = createContext<SyncContextValue | null>(null);

/**
 * Hook to access the sync context.
 *
 * Defined here (not in SyncProvider) so that consumer modules avoid
 * transitively importing expo-constants via SyncProvider -> config.ts.
 */
export function useSync(): SyncContextValue {
  const ctx = useContext(SyncCtx);
  if (ctx === null) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}
