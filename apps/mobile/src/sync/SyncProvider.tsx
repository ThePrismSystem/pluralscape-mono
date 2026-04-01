import { createContext, useContext } from "react";

import type { SyncEngine } from "@pluralscape/sync";
import type { ReactNode } from "react";

export interface SyncContextValue {
  readonly engine: SyncEngine | null;
  readonly isBootstrapped: boolean;
}

const Ctx = createContext<SyncContextValue | null>(null);

// Engine is always null in this scaffold — full wiring (WebSocket transport,
// key resolver, replication profile) is assembled in a later task once the
// relay transport layer is finalised.
const DEFERRED_ENGINE: SyncEngine | null = null;

export function SyncProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  // Future wiring will use these hooks:
  // - useAuth() — to get the master key for encrypting/decrypting sync payloads
  // - useConnection() — to get connection status and SSE event stream
  // - usePlatform() — to get the storage driver for local persistence

  const value: SyncContextValue = { engine: DEFERRED_ENGINE, isBootstrapped: false };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}
