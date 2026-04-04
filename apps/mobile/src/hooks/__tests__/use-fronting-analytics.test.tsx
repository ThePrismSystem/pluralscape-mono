// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...(actual as object), useCallback: (fn: unknown) => fn };
});

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

vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn(() => TEST_SYSTEM_ID),
}));

const { useFrontingAnalytics, useCoFrontingAnalytics } =
  await import("../use-fronting-analytics.js");

// ── Tests ────────────────────────────────────────────────────────────
const ANALYTICS_STALE_TIME = 300_000;

describe("useFrontingAnalytics", () => {
  it("passes staleTime option", () => {
    useFrontingAnalytics();
    expect(lastFrontingOpts["staleTime"]).toBe(ANALYTICS_STALE_TIME);
  });

  it("does not require masterKey", () => {
    useFrontingAnalytics();
    // No enabled guard — always enabled
    expect(lastFrontingOpts["enabled"]).toBeUndefined();
  });
});

describe("useCoFrontingAnalytics", () => {
  it("passes staleTime option", () => {
    useCoFrontingAnalytics();
    expect(lastCoFrontingOpts["staleTime"]).toBe(ANALYTICS_STALE_TIME);
  });

  it("does not require masterKey", () => {
    useCoFrontingAnalytics();
    expect(lastCoFrontingOpts["enabled"]).toBeUndefined();
  });
});
