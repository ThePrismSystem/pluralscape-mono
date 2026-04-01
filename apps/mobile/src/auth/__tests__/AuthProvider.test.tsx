import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthStateMachine } from "../auth-state-machine.js";
import { AuthProvider, useAuth } from "../AuthProvider.js";
import { createTokenStore } from "../token-store.js";

import type { AuthContextValue } from "../AuthProvider.js";
import type { TokenStore } from "../token-store.js";

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

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
      <AuthProvider machine={machine} tokenStore={tokenStore}>
        <Consumer />
      </AuthProvider>,
    );

    expect(snapshots).toHaveLength(1);
    const captured = snapshots[0] as AuthContextValue;
    expect(captured.state).toBe("unauthenticated");
    expect(captured.session).toBeNull();
    expect(captured.credentials).toBeNull();
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
});
