import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

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
    if (auth.snapshot.state === "unlocked") {
      const { sessionToken, systemId } = auth.snapshot.credentials;
      manager.connect(sessionToken, systemId);
    } else {
      manager.disconnect();
    }
  }, [manager, auth.snapshot]);

  const subscribe = useCallback(
    (listener: (state: ConnectionState) => void) => manager.subscribe(listener),
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
