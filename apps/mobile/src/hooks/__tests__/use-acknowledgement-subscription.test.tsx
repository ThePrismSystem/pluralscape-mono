// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

// ── Capture subscription calls ───────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastSubscriptionOpts: CapturedOpts = {};

const mockUtils = {
  acknowledgement: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    acknowledgement: {
      onChange: {
        useSubscription: (_input: unknown, opts: CapturedOpts) => {
          lastSubscriptionOpts = opts;
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

const { useAcknowledgementSubscription } = await import("../use-acknowledgement-subscription.js");

// ── Tests ────────────────────────────────────────────────────────────
describe("useAcknowledgementSubscription", () => {
  beforeEach(() => {
    lastSubscriptionOpts = {};
    vi.clearAllMocks();
  });

  it("enabled defaults to true", () => {
    renderHookWithProviders(() => {
      useAcknowledgementSubscription();
    });
    expect(lastSubscriptionOpts["enabled"]).toBe(true);
  });

  it("respects enabled: false", () => {
    renderHookWithProviders(() => {
      useAcknowledgementSubscription({ enabled: false });
    });
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });

  it("onError handler is present", () => {
    renderHookWithProviders(() => {
      useAcknowledgementSubscription();
    });
    expect(lastSubscriptionOpts["onError"]).toBeDefined();
    expect(typeof lastSubscriptionOpts["onError"]).toBe("function");
  });

  it("onData with ackId invalidates get and list", () => {
    renderHookWithProviders(() => {
      useAcknowledgementSubscription();
    });
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({ ackId: "ack-1" });
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.acknowledgement.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      ackId: "ack-1",
    });
  });

  it("onData without ackId invalidates only list", () => {
    renderHookWithProviders(() => {
      useAcknowledgementSubscription();
    });
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({});
    expect(mockUtils.acknowledgement.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.acknowledgement.get.invalidate).not.toHaveBeenCalled();
  });

  it("is disabled in local source mode", () => {
    renderHookWithProviders(
      () => {
        useAcknowledgementSubscription();
      },
      { querySource: "local" },
    );
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });
});
