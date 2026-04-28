// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DataLayerProvider, useDataLayer } from "../DataLayerProvider.js";

import type { DataErrorEvent } from "@pluralscape/sync";
import type { SqliteDriver } from "@pluralscape/sync/adapters";

// ── Mocks ─────────────────────────────────────────────────────────────

function createMockDriver(): SqliteDriver {
  const stmt = {
    run: vi.fn((): Promise<void> => Promise.resolve()),
    all: vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([])),
    get: vi.fn((): Promise<Record<string, unknown> | undefined> => Promise.resolve(undefined)),
  };

  return {
    exec: vi.fn((): Promise<void> => Promise.resolve()),
    prepare: vi.fn(() => stmt) as SqliteDriver["prepare"],
    transaction: vi.fn(
      <T,>(fn: () => Promise<T>): Promise<T> => fn(),
    ) as SqliteDriver["transaction"],
    close: vi.fn((): Promise<void> => Promise.resolve()),
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
    storage: { backend: "sqlite-async" as const, driver: mockDriver },
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
    // ctx is defined iff the DataLayerProvider wired the context value.
    // Asserting on the specific fields narrows the type and proves shape.
    expect(typeof ctx?.eventBus.emit).toBe("function");
    expect(typeof ctx?.eventBus.on).toBe("function");
    expect(typeof ctx?.localDb.execute).toBe("function");
    expect(typeof ctx?.localDb.queryAll).toBe("function");
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

  it("emits data:error when local database initialize() rejects", async () => {
    const initError = new Error("WAL pragma failed");
    mockDriver.exec = vi.fn(
      (sql: string): Promise<void> =>
        sql.includes("journal_mode=WAL") ? Promise.reject(initError) : Promise.resolve(),
    );

    const emitted: DataErrorEvent[] = [];

    function Subscriber(): React.JSX.Element {
      const { eventBus } = useDataLayer();
      React.useEffect(() => {
        return eventBus.on("data:error", (event) => {
          emitted.push(event);
        });
      }, [eventBus]);
      return <span>ok</span>;
    }

    const qc = makeQueryClient();

    renderHook(() => null, {
      wrapper: ({ children }): React.JSX.Element => (
        <QueryClientProvider client={qc}>
          <DataLayerProvider>
            <Subscriber />
            {children}
          </DataLayerProvider>
        </QueryClientProvider>
      ),
    });

    await act(() => Promise.resolve());

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.message).toContain("initialization failed");
    expect(emitted[0]?.error).toBe(initError);
  });
});
