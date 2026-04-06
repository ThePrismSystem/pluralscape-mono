import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import { useAuth } from "../auth/index.js";

import { ConnectionManager } from "./connection-manager.js";

import type { ConnectionState } from "./connection-types.js";
import type { ReactNode } from "react";

export interface ConnectionContextValue {
  readonly status: ConnectionState;
  readonly manager: ConnectionManager;
}

const Ctx = createContext<ConnectionContextValue | null>(null);

const DISCONNECTED: ConnectionState = "disconnected";

export function ConnectionProvider({
  manager,
  children,
}: {
  readonly manager: ConnectionManager;
  readonly children: ReactNode;
}): React.JSX.Element {
  const auth = useAuth();
  const authState = auth.snapshot.state;
  const credentials = auth.snapshot.state === "unlocked" ? auth.snapshot.credentials : null;

  useEffect(() => {
    if (credentials) {
      manager.connect(credentials.sessionToken, credentials.systemId);
    } else {
      manager.disconnect();
    }
  }, [manager, authState, credentials]);

  const subscribe = useMemo(
    () => (listener: (state: ConnectionState) => void) => manager.subscribe(listener),
    [manager],
  );

  const status = useSyncExternalStore(
    subscribe,
    () => manager.getSnapshot(),
    () => DISCONNECTED,
  );

  const value = useMemo<ConnectionContextValue>(() => ({ status, manager }), [status, manager]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error("useConnection must be used within ConnectionProvider");
  }
  return ctx;
}
