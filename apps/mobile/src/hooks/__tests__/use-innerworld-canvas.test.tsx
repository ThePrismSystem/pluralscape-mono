// @vitest-environment happy-dom
import { configureSodium, initSodium } from "@pluralscape/crypto";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { act, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRawCanvas } from "../../__tests__/factories.js";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

beforeAll(async () => {
  configureSodium(new WasmSodiumAdapter());
  await initSodium();
});

// ── Fixture registry (accessible from vi.mock via hoisting) ──────────
const { fixtures } = vi.hoisted(() => {
  const store = new Map<string, unknown>();
  return { fixtures: store };
});

// ── Mock utils for mutation invalidation tracking ────────────────────
const mockUtils = {
  innerworld: {
    canvas: {
      get: { invalidate: vi.fn() },
    },
  },
};

vi.mock("@pluralscape/api-client/trpc", async () => {
  const rq = await import("@tanstack/react-query");

  return {
    trpc: {
      innerworld: {
        canvas: {
          get: {
            useQuery: (input: unknown, opts: Record<string, unknown> = {}) =>
              rq.useQuery({
                queryKey: ["innerworld.canvas.get", input],
                queryFn: () => Promise.resolve(fixtures.get("canvas.get")),
                enabled: opts.enabled as boolean | undefined,
                select: opts.select as ((d: unknown) => unknown) | undefined,
              }),
          },
          upsert: {
            useMutation: (opts: Record<string, unknown> = {}) =>
              rq.useMutation({
                mutationFn: () => Promise.resolve({}),
                onSuccess: opts.onSuccess as (() => void) | undefined,
              }),
          },
        },
      },
      useUtils: () => mockUtils,
    },
  };
});

// Must import AFTER vi.mock
const { useCanvas, useUpsertCanvas } = await import("../use-innerworld-canvas.js");

beforeEach(() => {
  fixtures.clear();
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────
describe("useCanvas", () => {
  it("returns decrypted canvas data", async () => {
    fixtures.set("canvas.get", makeRawCanvas());
    const { result } = renderHookWithProviders(() => useCanvas());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.viewportX).toBe(0);
    expect(result.current.data?.viewportY).toBe(0);
    expect(result.current.data?.zoom).toBe(1);
    expect(result.current.data?.dimensions).toEqual({ width: 1000, height: 800 });
  });

  it("does not fetch when masterKey is null", () => {
    const { result } = renderHookWithProviders(() => useCanvas(), { masterKey: null });
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("select is stable across rerenders (useCallback memoization)", async () => {
    fixtures.set("canvas.get", makeRawCanvas());
    const { result, rerender } = renderHookWithProviders(() => useCanvas());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const ref1 = result.current.data;
    rerender();
    expect(result.current.data).toBe(ref1);
  });
});

describe("useUpsertCanvas", () => {
  it("invalidates canvas get on success", async () => {
    const { result } = renderHookWithProviders(() => useUpsertCanvas());

    await act(() => result.current.mutateAsync({} as never));

    await waitFor(() => {
      expect(mockUtils.innerworld.canvas.get.invalidate).toHaveBeenCalledWith({
        systemId: TEST_SYSTEM_ID,
      });
    });
  });
});
