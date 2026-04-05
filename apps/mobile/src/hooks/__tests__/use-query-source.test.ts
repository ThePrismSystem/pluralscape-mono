// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../platform/PlatformProvider.js", () => ({
  usePlatform: vi.fn(),
}));

vi.mock("../../sync/SyncProvider.js", () => ({
  useSync: vi.fn(),
}));

vi.mock("../../data/DataLayerProvider.js", () => ({
  useDataLayerOptional: vi.fn(),
}));

import { useDataLayerOptional } from "../../data/DataLayerProvider.js";
import { usePlatform } from "../../platform/PlatformProvider.js";
import { useSync } from "../../sync/SyncProvider.js";
import { useQuerySource, useLocalDb } from "../use-query-source.js";

import type { DataLayerContextValue } from "../../data/DataLayerProvider.js";
import type { PlatformContext } from "../../platform/types.js";
import type { SyncContextValue } from "../../sync/SyncProvider.js";

const mockUsePlatform = vi.mocked(usePlatform);
const mockUseSync = vi.mocked(useSync);
const mockUseDataLayerOptional = vi.mocked(useDataLayerOptional);

function makePlatform(backend: "sqlite" | "indexeddb"): PlatformContext {
  if (backend === "sqlite") {
    return {
      capabilities: {
        hasSecureStorage: true,
        hasBiometric: false,
        hasBackgroundSync: false,
        hasNativeMemzero: false,
        storageBackend: "sqlite",
      },
      storage: { backend: "sqlite", driver: {} as never },
      crypto: {} as never,
    };
  }
  return {
    capabilities: {
      hasSecureStorage: false,
      hasBiometric: false,
      hasBackgroundSync: false,
      hasNativeMemzero: false,
      storageBackend: "indexeddb",
    },
    storage: {
      backend: "indexeddb",
      storageAdapter: {} as never,
      offlineQueueAdapter: {} as never,
    },
    crypto: {} as never,
  };
}

function makeSync(isBootstrapped: boolean): SyncContextValue {
  return { engine: null, isBootstrapped, progress: null };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useQuerySource", () => {
  it('returns "local" when sqlite and bootstrapped', () => {
    mockUsePlatform.mockReturnValue(makePlatform("sqlite"));
    mockUseSync.mockReturnValue(makeSync(true));

    const { result } = renderHook(() => useQuerySource());
    expect(result.current).toBe("local");
  });

  it('returns "remote" when sqlite but not bootstrapped', () => {
    mockUsePlatform.mockReturnValue(makePlatform("sqlite"));
    mockUseSync.mockReturnValue(makeSync(false));

    const { result } = renderHook(() => useQuerySource());
    expect(result.current).toBe("remote");
  });

  it('returns "remote" when indexeddb (non-sqlite) even if bootstrapped', () => {
    mockUsePlatform.mockReturnValue(makePlatform("indexeddb"));
    mockUseSync.mockReturnValue(makeSync(true));

    const { result } = renderHook(() => useQuerySource());
    expect(result.current).toBe("remote");
  });

  it('returns "remote" when indexeddb and not bootstrapped', () => {
    mockUsePlatform.mockReturnValue(makePlatform("indexeddb"));
    mockUseSync.mockReturnValue(makeSync(false));

    const { result } = renderHook(() => useQuerySource());
    expect(result.current).toBe("remote");
  });
});

describe("useLocalDb", () => {
  it("returns localDb when DataLayer context is available", () => {
    const fakeLocalDb = { initialize: vi.fn(), queryAll: vi.fn() };
    const fakeContext: DataLayerContextValue = {
      localDb: fakeLocalDb as never,
      eventBus: {} as never,
    };
    mockUseDataLayerOptional.mockReturnValue(fakeContext);

    const { result } = renderHook(() => useLocalDb());
    expect(result.current).toBe(fakeLocalDb);
  });

  it("returns null when DataLayer context is not available", () => {
    mockUseDataLayerOptional.mockReturnValue(null);

    const { result } = renderHook(() => useLocalDb());
    expect(result.current).toBeNull();
  });
});
