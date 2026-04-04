// @vitest-environment happy-dom
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastCanvasGetOpts: CapturedOpts = {};

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
            useQuery: (_input: unknown, opts: CapturedOpts = {}) => {
              lastCanvasGetOpts = opts;
              return rq.useQuery({
                queryKey: ["innerworld.canvas.get", _input],
                queryFn: () =>
                  Promise.resolve({
                    systemId: TEST_SYSTEM_ID,
                    viewportX: 0,
                    viewportY: 0,
                    zoom: 1,
                    dimensions: { width: 1000, height: 800 },
                  }),
              });
            },
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
  lastCanvasGetOpts = {};
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────
describe("useCanvas", () => {
  it("has no enabled guard (always fetches)", () => {
    renderHookWithProviders(() => useCanvas());
    expect(lastCanvasGetOpts["enabled"]).toBeUndefined();
  });

  it("returns canvas data", async () => {
    const { result } = renderHookWithProviders(() => useCanvas());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.viewportX).toBe(0);
    expect(result.current.data?.viewportY).toBe(0);
    expect(result.current.data?.zoom).toBe(1);
    expect(result.current.data?.dimensions).toEqual({ width: 1000, height: 800 });
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
