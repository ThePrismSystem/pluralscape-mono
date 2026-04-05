import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SyncProvider, useSync } from "../SyncProvider.js";

import type { AuthContextValue } from "../../auth/AuthProvider.js";
import type { ConnectionContextValue } from "../../connection/ConnectionProvider.js";
import type { DataLayerContextValue } from "../../data/DataLayerProvider.js";
import type { PlatformContext } from "../../platform/types.js";

// ── Minimal context mocks ────────────────────────────────────────────

vi.mock("../../auth/index.js", () => ({
  useAuth: (): AuthContextValue => ({
    snapshot: { state: "unauthenticated", session: null, credentials: null },
    login: vi.fn(),
    logout: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
  }),
}));

vi.mock("../../connection/index.js", () => ({
  useConnection: (): ConnectionContextValue => ({
    status: "disconnected",
    manager: {} as ConnectionContextValue["manager"],
  }),
}));

vi.mock("../../data/DataLayerProvider.js", async () => {
  const { createEventBus } = await import("@pluralscape/sync");
  return {
    useDataLayer: (): DataLayerContextValue => ({
      eventBus: createEventBus(),
      localDb: {} as DataLayerContextValue["localDb"],
    }),
  };
});

vi.mock("../../platform/index.js", () => ({
  usePlatform: (): PlatformContext =>
    ({
      capabilities: {
        hasSecureStorage: false,
        hasBiometric: false,
        hasBackgroundSync: false,
        hasNativeMemzero: false,
        storageBackend: "sqlite",
      },
      storage: {} as PlatformContext["storage"],
      crypto: {} as PlatformContext["crypto"],
    }) satisfies PlatformContext,
}));

// ── Tests ────────────────────────────────────────────────────────────

describe("SyncProvider", () => {
  it("provides null engine and isBootstrapped:false when not ready", () => {
    const snapshots: ReturnType<typeof useSync>[] = [];

    function Consumer(): React.JSX.Element {
      snapshots.push(useSync());
      return <span>ok</span>;
    }

    renderToString(
      <SyncProvider>
        <Consumer />
      </SyncProvider>,
    );

    expect(snapshots).toHaveLength(1);
    const captured = snapshots[0] as ReturnType<typeof useSync>;
    expect(captured.engine).toBeNull();
    expect(captured.isBootstrapped).toBe(false);
  });

  it("provides isBootstrapped as false initially", () => {
    const snapshots: ReturnType<typeof useSync>[] = [];

    function Consumer(): React.JSX.Element {
      snapshots.push(useSync());
      return <span>ok</span>;
    }

    renderToString(
      <SyncProvider>
        <Consumer />
      </SyncProvider>,
    );

    expect(snapshots).toHaveLength(1);
    expect((snapshots[0] as ReturnType<typeof useSync>).isBootstrapped).toBe(false);
  });

  it("provides engine as null when auth is not unlocked", () => {
    const snapshots: ReturnType<typeof useSync>[] = [];

    function Consumer(): React.JSX.Element {
      snapshots.push(useSync());
      return <span>ok</span>;
    }

    renderToString(
      <SyncProvider>
        <Consumer />
      </SyncProvider>,
    );

    expect(snapshots).toHaveLength(1);
    expect((snapshots[0] as ReturnType<typeof useSync>).engine).toBeNull();
  });

  it("throws when useSync is used outside SyncProvider", () => {
    function BadConsumer(): React.JSX.Element {
      useSync();
      return <span>bad</span>;
    }

    expect(() => {
      renderToString(<BadConsumer />);
    }).toThrow("useSync must be used within SyncProvider");
  });
});
