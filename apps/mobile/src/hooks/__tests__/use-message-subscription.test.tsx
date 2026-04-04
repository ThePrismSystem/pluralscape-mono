// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

import { TEST_SYSTEM_ID } from "./helpers/test-crypto.js";

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

vi.mock("../../providers/system-provider.js", () => ({
  useActiveSystemId: vi.fn(() => TEST_SYSTEM_ID),
}));

const { useMessageSubscription } = await import("../use-message-subscription.js");

const CHANNEL_ID = "ch-1" as ChannelId;

// ── Tests ────────────────────────────────────────────────────────────
describe("useMessageSubscription", () => {
  it("enabled defaults to true", () => {
    useMessageSubscription(CHANNEL_ID);
    expect(lastSubscriptionOpts["enabled"]).toBe(true);
  });

  it("respects enabled: false", () => {
    useMessageSubscription(CHANNEL_ID, { enabled: false });
    expect(lastSubscriptionOpts["enabled"]).toBe(false);
  });

  it("onError handler is present", () => {
    useMessageSubscription(CHANNEL_ID);
    expect(lastSubscriptionOpts["onError"]).toBeDefined();
    expect(typeof lastSubscriptionOpts["onError"]).toBe("function");
  });

  it("onData with messageId invalidates get and list", () => {
    mockUtils.message.get.invalidate.mockClear();
    mockUtils.message.list.invalidate.mockClear();
    useMessageSubscription(CHANNEL_ID);
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
    mockUtils.message.get.invalidate.mockClear();
    mockUtils.message.list.invalidate.mockClear();
    useMessageSubscription(CHANNEL_ID);
    const onData = lastSubscriptionOpts["onData"] as (event: Record<string, unknown>) => void;
    onData({});
    expect(mockUtils.message.list.invalidate).toHaveBeenCalledWith({
      systemId: TEST_SYSTEM_ID,
      channelId: CHANNEL_ID,
    });
    expect(mockUtils.message.get.invalidate).not.toHaveBeenCalled();
  });
});
