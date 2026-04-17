// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

// ── Capture subscription calls ───────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastSubscriptionOpts: CapturedOpts = {};

const mockUtils = {
  boardMessage: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    boardMessage: {
      onChange: {
        useSubscription: (_input: unknown, opts: CapturedOpts) => {
          lastSubscriptionOpts = opts;
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

const { useBoardMessageSubscription } = await import("../use-board-message-subscription.js");

// ── Tests ────────────────────────────────────────────────────────────
describe("useBoardMessageSubscription", () => {
  beforeEach(() => {
    lastSubscriptionOpts = {};
    vi.clearAllMocks();
  });

  it("enabled defaults to true", () => {
    renderHookWithProviders(() => {
      useBoardMessageSubscription();
    });
    expect(lastSubscriptionOpts["enabled"]).toBe(true);
  });

  it("respects enabled: false", () => {
    renderHookWithProviders(() => {
      useBoardMessageSubscription({ enabled: false });
    });
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });

  it("onError handler is present", () => {
    renderHookWithProviders(() => {
      useBoardMessageSubscription();
    });
    expect(typeof lastSubscriptionOpts["onError"]).toBe("function");
  });

  it("onData with boardMessageId invalidates get and list", () => {
    renderHookWithProviders(() => {
      useBoardMessageSubscription();
    });
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({ boardMessageId: "bm-1" });
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.boardMessage.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      boardMessageId: "bm-1",
    });
  });

  it("onData without boardMessageId invalidates only list", () => {
    renderHookWithProviders(() => {
      useBoardMessageSubscription();
    });
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({});
    expect(mockUtils.boardMessage.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
    });
    expect(mockUtils.boardMessage.get.invalidate).not.toHaveBeenCalled();
  });

  it("is disabled in local source mode", () => {
    renderHookWithProviders(
      () => {
        useBoardMessageSubscription();
      },
      { querySource: "local" },
    );
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });
});
