import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DataLayerProvider, useDataLayer } from "../DataLayerProvider.js";

import type { SqliteDriver } from "@pluralscape/sync/adapters";

// ── Mocks ─────────────────────────────────────────────────────────────

function createMockDriver(): SqliteDriver {
  const stmt = {
    run: vi.fn(),
    all: vi.fn((): Record<string, unknown>[] => []),
    get: vi.fn((): Record<string, unknown> | undefined => undefined),
  };

  return {
    exec: vi.fn(),
    prepare: vi.fn(() => stmt) as SqliteDriver["prepare"],
    transaction: vi.fn((fn: () => unknown) => fn()) as SqliteDriver["transaction"],
    close: vi.fn(),
  };
}

const mockDriver = createMockDriver();

vi.mock("../../platform/PlatformProvider.js", () => ({
  usePlatform: () => ({
    capabilities: {
      hasSecureStorage: false,
      hasBiometric: false,
      hasBackgroundSync: false,
      hasNativeMemzero: false,
      storageBackend: "sqlite" as const,
    },
    storage: { backend: "sqlite" as const, driver: mockDriver },
    crypto: {},
  }),
}));

vi.mock("@pluralscape/sync/materializer", () => ({
  generateAllDdl: vi.fn(() => ["CREATE TABLE test (id TEXT)"]),
}));

vi.mock("../query-invalidator.js", () => ({
  createQueryInvalidator: vi.fn(() => vi.fn()),
}));

// ── Helpers ───────────────────────────────────────────────────────────

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("DataLayerProvider", () => {
  it("renders children without throwing", () => {
    const qc = makeQueryClient();
    let html = "";

    expect(() => {
      html = renderToString(
        <QueryClientProvider client={qc}>
          <DataLayerProvider>
            <span id="child">hello</span>
          </DataLayerProvider>
        </QueryClientProvider>,
      );
    }).not.toThrow();

    expect(html).toContain("hello");
  });

  it("useDataLayer returns context with eventBus and localDb", () => {
    const qc = makeQueryClient();
    const snapshots: ReturnType<typeof useDataLayer>[] = [];

    function Consumer(): React.JSX.Element {
      snapshots.push(useDataLayer());
      return <span>ok</span>;
    }

    renderToString(
      <QueryClientProvider client={qc}>
        <DataLayerProvider>
          <Consumer />
        </DataLayerProvider>
      </QueryClientProvider>,
    );

    expect(snapshots).toHaveLength(1);
    const ctx = snapshots[0];
    expect(ctx).toBeDefined();
    expect(typeof ctx?.eventBus.emit).toBe("function");
    expect(typeof ctx?.eventBus.on).toBe("function");
    expect(ctx?.localDb).toBeDefined();
  });

  it("useDataLayer throws when used outside DataLayerProvider", () => {
    function BadConsumer(): React.JSX.Element {
      useDataLayer();
      return <span>bad</span>;
    }

    const qc = makeQueryClient();

    expect(() => {
      renderToString(
        <QueryClientProvider client={qc}>
          <BadConsumer />
        </QueryClientProvider>,
      );
    }).toThrow("useDataLayer must be used within DataLayerProvider");
  });
});
