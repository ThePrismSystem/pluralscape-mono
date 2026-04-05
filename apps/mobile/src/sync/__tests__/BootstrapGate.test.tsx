// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformContext, PlatformStorage } from "../../platform/types.js";
import type { SyncContextValue } from "../SyncProvider.js";

// ── Mutable mock state ─────────────────────────────────────────────

let mockPlatformStorage: PlatformStorage = {
  backend: "sqlite",
  driver: {
    exec: vi.fn(),
    prepare: vi.fn(),
    transaction: vi.fn((fn: () => unknown) => fn()),
    close: vi.fn(),
  },
};

let mockSyncValue: SyncContextValue = {
  engine: null,
  isBootstrapped: false,
  progress: null,
};

// ── Module mocks ────────────────────────────────────────────────────

vi.mock("../../platform/index.js", () => ({
  usePlatform: (): PlatformContext => ({
    capabilities: {
      hasSecureStorage: false,
      hasBiometric: false,
      hasBackgroundSync: false,
      hasNativeMemzero: false,
      storageBackend: "sqlite",
    },
    storage: mockPlatformStorage,
    crypto: {} as PlatformContext["crypto"],
  }),
}));

vi.mock("../SyncProvider.js", () => ({
  useSync: (): SyncContextValue => mockSyncValue,
}));

// Dynamic import after mocks
const { BootstrapGate } = await import("../BootstrapGate.js");

// ── Tests ───────────────────────────────────────────────────────────

describe("BootstrapGate", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformStorage = {
      backend: "sqlite",
      driver: {
        exec: vi.fn(),
        prepare: vi.fn(),
        transaction: vi.fn((fn: () => unknown) => fn()),
        close: vi.fn(),
      },
    };
    mockSyncValue = { engine: null, isBootstrapped: false, progress: null };
  });

  it("renders children immediately when no local DB (tRPC mode / indexeddb backend)", () => {
    mockPlatformStorage = {
      backend: "indexeddb",
      storageAdapter: {} as PlatformStorage & { backend: "indexeddb" } extends {
        storageAdapter: infer T;
      }
        ? T
        : never,
      offlineQueueAdapter: {} as PlatformStorage & { backend: "indexeddb" } extends {
        offlineQueueAdapter: infer T;
      }
        ? T
        : never,
    };
    mockSyncValue = { engine: null, isBootstrapped: false, progress: null };

    render(
      <BootstrapGate>
        <div>App Content</div>
      </BootstrapGate>,
    );

    expect(screen.getByText("App Content")).toBeDefined();
  });

  it("shows loading screen when local DB exists but not bootstrapped", () => {
    mockPlatformStorage = {
      backend: "sqlite",
      driver: {
        exec: vi.fn(),
        prepare: vi.fn(),
        transaction: vi.fn((fn: () => unknown) => fn()),
        close: vi.fn(),
      },
    };
    mockSyncValue = { engine: null, isBootstrapped: false, progress: null };

    render(
      <BootstrapGate>
        <div>App Content</div>
      </BootstrapGate>,
    );

    expect(screen.queryByText("App Content")).toBeNull();
    expect(screen.getByText("Setting up your data...")).toBeDefined();
  });

  it("shows progress in loading screen when progress is available", () => {
    mockPlatformStorage = {
      backend: "sqlite",
      driver: {
        exec: vi.fn(),
        prepare: vi.fn(),
        transaction: vi.fn((fn: () => unknown) => fn()),
        close: vi.fn(),
      },
    };
    mockSyncValue = { engine: null, isBootstrapped: false, progress: { synced: 3, total: 10 } };

    render(
      <BootstrapGate>
        <div>App Content</div>
      </BootstrapGate>,
    );

    expect(screen.queryByText("App Content")).toBeNull();
    expect(screen.getByText("Setting up (3/10)...")).toBeDefined();
  });

  it("renders children when local DB exists and is bootstrapped", () => {
    mockPlatformStorage = {
      backend: "sqlite",
      driver: {
        exec: vi.fn(),
        prepare: vi.fn(),
        transaction: vi.fn((fn: () => unknown) => fn()),
        close: vi.fn(),
      },
    };
    mockSyncValue = { engine: null, isBootstrapped: true, progress: null };

    render(
      <BootstrapGate>
        <div>App Content</div>
      </BootstrapGate>,
    );

    expect(screen.getByText("App Content")).toBeDefined();
    expect(screen.queryByText("Setting up your data...")).toBeNull();
  });
});
