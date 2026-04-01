import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectionManager } from "../connection-manager.js";
import { ConnectionProvider, useConnection } from "../ConnectionProvider.js";

import type { AuthContextValue } from "../../auth/AuthProvider.js";
import type { SystemId } from "@pluralscape/types";

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource: vi.fn(),
}));

// Default to unauthenticated — individual tests override via spy.
let mockAuthValue: AuthContextValue = {
  snapshot: { state: "unauthenticated", session: null, credentials: null },
  login: vi.fn(),
  logout: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
};

vi.mock("../../auth/index.js", () => ({
  useAuth: () => mockAuthValue,
}));

function makeManager(): ConnectionManager {
  return new ConnectionManager({ baseUrl: "https://example.com" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthValue = {
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

  it("manager accepts connect with token and systemId", () => {
    const manager = makeManager();
    const spy = vi.spyOn(manager, "connect");

    function Consumer(): React.JSX.Element {
      useConnection();
      return <span>ok</span>;
    }

    renderToString(
      <ConnectionProvider manager={manager}>
        <Consumer />
      </ConnectionProvider>,
    );

    manager.connect("tok", "sys_1" as SystemId);
    expect(spy).toHaveBeenCalledWith("tok", "sys_1");
    expect(manager.getSnapshot()).toBe("connecting");
  });
});
