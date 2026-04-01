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
const INITIAL_VALUE: SyncContextValue = { engine: null, isBootstrapped: false };

export function SyncProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <Ctx.Provider value={INITIAL_VALUE}>{children}</Ctx.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error("useSync must be used within SyncProvider");
  }
  return ctx;
}
