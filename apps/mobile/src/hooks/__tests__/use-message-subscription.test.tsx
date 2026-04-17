// @vitest-environment happy-dom
import { brandId } from "@pluralscape/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders, TEST_SYSTEM_ID } from "./helpers/render-hook-with-providers.js";

import type { ChannelId } from "@pluralscape/types";

// ── Capture subscription calls ───────────────────────────────────────
type CapturedOpts = Record<string, unknown>;
let lastSubscriptionOpts: CapturedOpts = {};

const mockUtils = {
  message: {
    get: { invalidate: vi.fn() },
    list: { invalidate: vi.fn() },
  },
};

vi.mock("@pluralscape/api-client/trpc", () => ({
  trpc: {
    message: {
      onChange: {
        useSubscription: (_input: unknown, opts: CapturedOpts) => {
          lastSubscriptionOpts = opts;
        },
      },
    },
    useUtils: () => mockUtils,
  },
}));

const { useMessageSubscription } = await import("../use-message-subscription.js");

const CHANNEL_ID = brandId<ChannelId>("ch-1");

// ── Tests ────────────────────────────────────────────────────────────
describe("useMessageSubscription", () => {
  beforeEach(() => {
    lastSubscriptionOpts = {};
    vi.clearAllMocks();
  });

  it("enabled defaults to true", () => {
    renderHookWithProviders(() => {
      useMessageSubscription(CHANNEL_ID);
    });
    expect(lastSubscriptionOpts["enabled"]).toBe(true);
  });

  it("respects enabled: false", () => {
    renderHookWithProviders(() => {
      useMessageSubscription(CHANNEL_ID, { enabled: false });
    });
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });

  it("onError handler is present", () => {
    renderHookWithProviders(() => {
      useMessageSubscription(CHANNEL_ID);
    });
    expect(lastSubscriptionOpts["onError"]).toBeDefined();
    expect(typeof lastSubscriptionOpts["onError"]).toBe("function");
  });

  it("onData with messageId invalidates get and list", () => {
    renderHookWithProviders(() => {
      useMessageSubscription(CHANNEL_ID);
    });
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({ messageId: "msg-1" });
    expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: CHANNEL_ID,
    });
    expect(mockUtils.message.get.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: CHANNEL_ID,
      messageId: "msg-1",
    });
  });

  it("onData without messageId invalidates only list", () => {
    renderHookWithProviders(() => {
      useMessageSubscription(CHANNEL_ID);
    });
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({});
    expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: CHANNEL_ID,
    });
    expect(mockUtils.message.get.invalidate).not.toHaveBeenCalled();
  });

  it("is disabled in local source mode", () => {
    renderHookWithProviders(
      () => {
        useMessageSubscription(CHANNEL_ID);
      },
      { querySource: "local" },
    );
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });
});
