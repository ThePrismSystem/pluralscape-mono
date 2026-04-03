import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IDBFactory } from "fake-indexeddb";
import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthStateMachine } from "../auth-state-machine.js";
import { AuthProvider, useAuth } from "../AuthProvider.js";
import { createTokenStore } from "../token-store.js";

import type { AuthCredentials, AuthSession } from "../auth-types.js";
import type { AuthContextValue } from "../AuthProvider.js";
import type { TokenStore } from "../token-store.js";
import type {
  BoxPublicKey,
  BoxSecretKey,
  KdfMasterKey,
  PwhashSalt,
  SignPublicKey,
  SignSecretKey,
} from "@pluralscape/crypto";
import type { AccountId, SystemId } from "@pluralscape/types";

const fakeCredentials: AuthCredentials = {
  sessionToken: "tok-abc",
  accountId: "acct_123" as AccountId,
  systemId: "sys_456" as SystemId,
  salt: new Uint8Array(16) as PwhashSalt,
};

const fakeMasterKey = new Uint8Array(32) as KdfMasterKey;

const fakeIdentityKeys: AuthSession["identityKeys"] = {
  sign: {
    publicKey: new Uint8Array(32) as SignPublicKey,
    secretKey: new Uint8Array(64) as SignSecretKey,
  },
  box: {
    publicKey: new Uint8Array(32) as BoxPublicKey,
    secretKey: new Uint8Array(32) as BoxSecretKey,
  },
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function makeProviderDeps(): Promise<{
  machine: AuthStateMachine;
  tokenStore: TokenStore;
}> {
  const machine = new AuthStateMachine();
  const tokenStore = await createTokenStore({ hasSecureStorage: false });
  return { machine, tokenStore };
}

describe("AuthProvider", () => {
  it("provides unauthenticated state by default", async () => {
    const { machine, tokenStore } = await makeProviderDeps();
    const snapshots: AuthContextValue[] = [];

    function Consumer(): React.JSX.Element {
      snapshots.push(useAuth());
      return <span>ok</span>;
    }

    renderToString(
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider machine={machine} tokenStore={tokenStore}>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(snapshots).toHaveLength(1);
    const captured = snapshots[0] as AuthContextValue;
    expect(captured.snapshot.state).toBe("unauthenticated");
    expect(captured.snapshot.session).toBeNull();
    expect(captured.snapshot.credentials).toBeNull();
    expect(captured.snapshot).toEqual({
      state: "unauthenticated",
      session: null,
      credentials: null,
    });
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    function BadConsumer(): React.JSX.Element {
      useAuth();
      return <span>bad</span>;
    }

    expect(() => {
      renderToString(<BadConsumer />);
    }).toThrow("useAuth must be used within AuthProvider");
  });

  it("rolls back to unauthenticated if token store fails during login", async () => {
    const machine = new AuthStateMachine();
    const failingTokenStore: TokenStore = {
      getToken: () => Promise.resolve(null),
      setToken: () => Promise.reject(new Error("disk full")),
      clearToken: () => Promise.resolve(),
    };

    const captured: AuthContextValue[] = [];

    function Consumer(): React.JSX.Element {
      captured.push(useAuth());
      return <span>ok</span>;
    }

    renderToString(
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider machine={machine} tokenStore={failingTokenStore}>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    );

    const auth = captured[0] as AuthContextValue;

    await expect(auth.login(fakeCredentials, fakeMasterKey, fakeIdentityKeys)).rejects.toThrow(
      "disk full",
    );

    expect(machine.getSnapshot().state).toBe("unauthenticated");
  });

  it("login dispatches LOGIN and persists token", async () => {
    const { machine, tokenStore } = await makeProviderDeps();
    const dispatchSpy = vi.spyOn(machine, "dispatch");
    const setTokenSpy = vi.spyOn(tokenStore, "setToken");

    const captured: AuthContextValue[] = [];
    function Consumer(): React.JSX.Element {
      captured.push(useAuth());
      return <span>ok</span>;
    }

    renderToString(
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider machine={machine} tokenStore={tokenStore}>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    );

    const auth = captured[0] as AuthContextValue;
    await auth.login(fakeCredentials, fakeMasterKey, fakeIdentityKeys);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: "LOGIN",
      credentials: fakeCredentials,
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    expect(setTokenSpy).toHaveBeenCalledWith("tok-abc");
    expect(machine.getSnapshot().state).toBe("unlocked");
  });

  it("logout clears token then dispatches LOGOUT", async () => {
    const { machine, tokenStore } = await makeProviderDeps();
    const dispatchSpy = vi.spyOn(machine, "dispatch");
    const clearTokenSpy = vi.spyOn(tokenStore, "clearToken");

    const captured: AuthContextValue[] = [];
    function Consumer(): React.JSX.Element {
      captured.push(useAuth());
      return <span>ok</span>;
    }

    renderToString(
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider machine={machine} tokenStore={tokenStore}>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    );

    const auth = captured[0] as AuthContextValue;
    await auth.login(fakeCredentials, fakeMasterKey, fakeIdentityKeys);
    await auth.logout();

    expect(clearTokenSpy).toHaveBeenCalledOnce();
    expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOGOUT" });
    expect(machine.getSnapshot().state).toBe("unauthenticated");
  });

  it("does not dispatch LOGOUT when clearToken fails", async () => {
    const machine = new AuthStateMachine();
    const failingTokenStore: TokenStore = {
      getToken: () => Promise.resolve(null),
      setToken: () => Promise.resolve(),
      clearToken: () => Promise.reject(new Error("storage unavailable")),
    };

    const captured: AuthContextValue[] = [];
    function Consumer(): React.JSX.Element {
      captured.push(useAuth());
      return <span>ok</span>;
    }

    renderToString(
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider machine={machine} tokenStore={failingTokenStore}>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    );

    const auth = captured[0] as AuthContextValue;
    await auth.login(fakeCredentials, fakeMasterKey, fakeIdentityKeys);

    await expect(auth.logout()).rejects.toThrow("storage unavailable");
    // State should remain unlocked — LOGOUT was NOT dispatched because clearToken failed
    expect(machine.getSnapshot().state).toBe("unlocked");
  });

  it("lock dispatches LOCK", async () => {
    const { machine, tokenStore } = await makeProviderDeps();
    const dispatchSpy = vi.spyOn(machine, "dispatch");

    const captured: AuthContextValue[] = [];
    function Consumer(): React.JSX.Element {
      captured.push(useAuth());
      return <span>ok</span>;
    }

    renderToString(
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider machine={machine} tokenStore={tokenStore}>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    );

    const auth = captured[0] as AuthContextValue;
    await auth.login(fakeCredentials, fakeMasterKey, fakeIdentityKeys);
    auth.lock();

    expect(dispatchSpy).toHaveBeenCalledWith({ type: "LOCK" });
    expect(machine.getSnapshot().state).toBe("locked");
  });

  it("unlock dispatches UNLOCK with masterKey and identityKeys", async () => {
    const { machine, tokenStore } = await makeProviderDeps();
    const dispatchSpy = vi.spyOn(machine, "dispatch");

    const captured: AuthContextValue[] = [];
    function Consumer(): React.JSX.Element {
      captured.push(useAuth());
      return <span>ok</span>;
    }

    renderToString(
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider machine={machine} tokenStore={tokenStore}>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    );

    const auth = captured[0] as AuthContextValue;
    await auth.login(fakeCredentials, fakeMasterKey, fakeIdentityKeys);
    auth.lock();
    auth.unlock(fakeMasterKey, fakeIdentityKeys);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: "UNLOCK",
      masterKey: fakeMasterKey,
      identityKeys: fakeIdentityKeys,
    });
    expect(machine.getSnapshot().state).toBe("unlocked");
  });
});
