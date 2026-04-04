// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./helpers/render-hook-with-providers.js";

// ── Capture tRPC hook calls ──────────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastFrontingOpts: CapturedOpts = {};
let lastCoFrontingOpts: CapturedOpts = {};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    analytics: {
      fronting: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastFrontingOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
      coFronting: {
        useQuery: (_input: unknown, opts: CapturedOpts) => {
          lastCoFrontingOpts = opts;
          return { data: undefined, isLoading: true, status: "loading" };
        },
      },
    },
  },
}));

const { useFrontingAnalytics, useCoFrontingAnalytics } =
  await import("../use-fronting-analytics.js");

// ── Tests ────────────────────────────────────────────────────────────
const ANALYTICS_STALE_TIME = 300_000;

describe("useFrontingAnalytics", () => {
  beforeEach(() => {
    lastFrontingOpts = {};
    vi.clearAllMocks();
  });

  it("passes staleTime option", () => {
    renderHookWithProviders(() => {
      useFrontingAnalytics();
    });
    expect(lastFrontingOpts["staleTime"]).toBe(ANALYTICS_STALE_TIME);
  });

  it("does not require masterKey", () => {
    renderHookWithProviders(() => {
      useFrontingAnalytics();
    });
    // No enabled guard — always enabled
    expect(lastFrontingOpts["enabled"]).toBeUndefined();
  });
});

describe("useCoFrontingAnalytics", () => {
  beforeEach(() => {
    lastCoFrontingOpts = {};
    vi.clearAllMocks();
  });

  it("passes staleTime option", () => {
    renderHookWithProviders(() => {
      useCoFrontingAnalytics();
    });
    expect(lastCoFrontingOpts["staleTime"]).toBe(ANALYTICS_STALE_TIME);
  });

  it("does not require masterKey", () => {
    renderHookWithProviders(() => {
      useCoFrontingAnalytics();
    });
    expect(lastCoFrontingOpts["enabled"]).toBeUndefined();
  });
});
