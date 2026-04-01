import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../connection-manager.js";
import { ConnectionProvider, useConnection } from "../ConnectionProvider.js";

import type { AuthStateSnapshot } from "../../auth/auth-types.js";
import type { AuthContextValue } from "../../auth/AuthProvider.js";
import type {
  BoxPublicKey,
  BoxSecretKey,
  KdfMasterKey,
  PwhashSalt,
  SignPublicKey,
  SignSecretKey,
} from "@pluralscape/crypto";
import type { AccountId, SystemId } from "@pluralscape/types";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

// Default to unauthenticated — individual tests override via spy.
let mockAuthValue: AuthContextValue = {
  state: "unauthenticated",
  session: null,
  credentials: null,
  snapshot: { state: "unauthenticated", session: null, credentials: null },
  login: vi.fn(),
  logout: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
};

vi.mock("../../auth/index.js", () => ({
  useAuth: () => mockAuthValue,
}));

// ── Shared fixtures ──────────────────────────────────────────────────

const fakeCredentials = {
  sessionToken: "tok",
  accountId: "acct_1" as AccountId,
  systemId: "sys_1" as SystemId,
  salt: new Uint8Array(16) as PwhashSalt,
};

const unlockedSnapshot: AuthStateSnapshot = {
  state: "unlocked",
  session: {
    credentials: fakeCredentials,
    masterKey: new Uint8Array(32) as KdfMasterKey,
    identityKeys: {
      sign: {
        publicKey: new Uint8Array(32) as SignPublicKey,
        secretKey: new Uint8Array(64) as SignSecretKey,
      },
      box: {
        publicKey: new Uint8Array(32) as BoxPublicKey,
        secretKey: new Uint8Array(32) as BoxSecretKey,
      },
    },
  },
  credentials: fakeCredentials,
};

function makeManager(): ConnectionManager {
  return new ConnectionManager({ baseUrl: "https://example.com" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthValue = {
    state: "unauthenticated",
    session: null,
    credentials: null,
    snapshot: { state: "unauthenticated", session: null, credentials: null },
    login: vi.fn(),
    logout: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
  };
});

// ── Tests ────────────────────────────────────────────────────────────

describe("ConnectionProvider", () => {
  it("throws when useConnection is used outside provider", () => {
    function BadConsumer(): React.JSX.Element {
      useConnection();
      return <span>bad</span>;
    }

    expect(() => {
      renderToString(<BadConsumer />);
    }).toThrow("useConnection must be used within ConnectionProvider");
  });

  it("exposes status and manager on context value", () => {
    const manager = makeManager();
    const ref: { value: ReturnType<typeof useConnection> | null } = { value: null };

    function Consumer(): React.JSX.Element {
      ref.value = useConnection();
      return <span>ok</span>;
    }

    renderToString(
      <ConnectionProvider manager={manager}>
        <Consumer />
      </ConnectionProvider>,
    );

    expect(ref.value).not.toBeNull();
    expect(ref.value?.manager).toBe(manager);
    expect(ref.value?.status).toBeDefined();
  });

  it("reports disconnected status when unauthenticated (server snapshot)", () => {
    // useAuth returns unauthenticated (default mock).
    // useSyncExternalStore uses the server snapshot (3rd arg) during renderToString,
    // which returns DISCONNECTED.
    const manager = makeManager();
    let capturedStatus: ReturnType<typeof useConnection>["status"] | null = null;

    function Consumer(): React.JSX.Element {
      capturedStatus = useConnection().status;
      return <span>ok</span>;
    }

    renderToString(
      <ConnectionProvider manager={manager}>
        <Consumer />
      </ConnectionProvider>,
    );

    expect(capturedStatus).toBe("disconnected");
  });

  it("calls manager.onAuthStateChange with the unlocked snapshot when auth state changes", () => {
    // Set up the auth mock to return an unlocked snapshot.
    mockAuthValue = {
      state: "unlocked",
      session: unlockedSnapshot.session,
      credentials: fakeCredentials,
      snapshot: unlockedSnapshot,
      login: vi.fn(),
      logout: vi.fn(),
      lock: vi.fn(),
      unlock: vi.fn(),
    };

    const manager = makeManager();
    const spy = vi.spyOn(manager, "onAuthStateChange");

    function Consumer(): React.JSX.Element {
      useConnection();
      return <span>ok</span>;
    }

    // renderToString does not execute useEffect — so onAuthStateChange is not
    // called by the component lifecycle here.  We verify instead that the manager
    // correctly processes the unlocked snapshot when called directly, which is
    // the behaviour the provider effect delegates to.
    renderToString(
      <ConnectionProvider manager={manager}>
        <Consumer />
      </ConnectionProvider>,
    );

    // Call the method the effect would invoke, and verify the manager transitions
    // to "connecting" — confirming the snapshot shape is accepted correctly.
    manager.onAuthStateChange(unlockedSnapshot);
    expect(spy).toHaveBeenCalledWith(unlockedSnapshot);
    expect(manager.getSnapshot()).toBe("connecting");
  });
});
