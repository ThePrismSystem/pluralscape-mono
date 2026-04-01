import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

import { AuthStateMachine } from "./auth-state-machine.js";

import type { AuthCredentials, AuthSession, AuthStateSnapshot } from "./auth-types.js";
import type { TokenStore } from "./token-store.js";
import type { KdfMasterKey } from "@pluralscape/crypto";
import type { ReactNode } from "react";

export interface AuthContextValue {
  readonly snapshot: AuthStateSnapshot;
  login(
    credentials: AuthCredentials,
    masterKey: KdfMasterKey,
    identityKeys: AuthSession["identityKeys"],
  ): Promise<void>;
  logout(): Promise<void>;
  lock(): void;
  unlock(masterKey: KdfMasterKey, identityKeys: AuthSession["identityKeys"]): void;
}

const UNAUTHENTICATED_SNAPSHOT: AuthStateSnapshot = {
  state: "unauthenticated",
  session: null,
  credentials: null,
};

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  machine,
  tokenStore,
  children,
}: {
  readonly machine: AuthStateMachine;
  readonly tokenStore: TokenStore;
  readonly children: ReactNode;
}): React.JSX.Element {
  const subscribe = useCallback((listener: () => void) => machine.subscribe(listener), [machine]);

  const snapshot = useSyncExternalStore(
    subscribe,
    () => machine.getSnapshot(),
    () => UNAUTHENTICATED_SNAPSHOT,
  );

  const login = useCallback(
    async (
      credentials: AuthCredentials,
      masterKey: KdfMasterKey,
      identityKeys: AuthSession["identityKeys"],
    ): Promise<void> => {
      machine.dispatch({ type: "LOGIN", credentials, masterKey, identityKeys });
      try {
        await tokenStore.setToken(credentials.sessionToken);
      } catch (err: unknown) {
        machine.dispatch({ type: "LOGOUT" });
        throw err;
      }
    },
    [machine, tokenStore],
  );

  const logout = useCallback(async (): Promise<void> => {
    await tokenStore.clearToken();
    machine.dispatch({ type: "LOGOUT" });
  }, [machine, tokenStore]);

  const lock = useCallback((): void => {
    machine.dispatch({ type: "LOCK" });
  }, [machine]);

  const unlock = useCallback(
    (masterKey: KdfMasterKey, identityKeys: AuthSession["identityKeys"]): void => {
      machine.dispatch({ type: "UNLOCK", masterKey, identityKeys });
    },
    [machine],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      snapshot,
      login,
      logout,
      lock,
      unlock,
    }),
    [snapshot, login, logout, lock, unlock],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
