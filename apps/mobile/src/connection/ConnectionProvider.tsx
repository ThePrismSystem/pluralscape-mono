import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

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

  useEffect(() => {
    manager.onAuthStateChange({
      state: auth.state,
      session: auth.session,
      credentials: auth.credentials,
    });
  }, [manager, auth.state, auth.session, auth.credentials]);

  const status = useSyncExternalStore(
    (listener) => manager.subscribe(listener),
    () => manager.getSnapshot(),
    () => DISCONNECTED,
  );

  const value: ConnectionContextValue = { status, manager };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error("useConnection must be used within ConnectionProvider");
  }
  return ctx;
}
